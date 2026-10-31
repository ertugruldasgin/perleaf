package compile

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/ertugruldasgin/latex-editor/internal/sandbox"
)

const maxFiles = 200

var (
	ErrQueueFull      = errors.New("compile queue is full")
	ErrInvalidRequest = errors.New("invalid compile request")
	ErrStopped        = errors.New("compile service stopped")
)

type Compiler interface {
	Compile(ctx context.Context, srcDir, mainFile string) (*sandbox.Result, error)
}

type Options struct {
	Workers   int
	QueueSize int
	Timeout   time.Duration
	JobTTL    time.Duration
}

type Service struct {
	compiler Compiler
	opts     Options
	queue    chan *Job

	mu   sync.Mutex
	jobs map[string]*Job

	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

func New(c Compiler, opts Options) *Service {
	ctx, cancel := context.WithCancel(context.Background())
	s := &Service{
		compiler: c,
		opts:     opts,
		queue:    make(chan *Job, opts.QueueSize),
		jobs:     make(map[string]*Job),
		ctx:      ctx,
		cancel:   cancel,
	}
	for range opts.Workers {
		s.wg.Go(s.worker)
	}
	s.wg.Go(s.janitor)

	return s
}

func (s *Service) Stop() {
	s.cancel()
	s.wg.Wait()
}

func (s *Service) Submit(mainFile string, files map[string]string) (Job, error) {
	if s.ctx.Err() != nil {
		return Job{}, ErrStopped
	}
	if err := validate(mainFile, files); err != nil {
		return Job{}, err
	}

	job := &Job{
		ID:        rand.Text(),
		Status:    StatusQueued,
		CreatedAt: time.Now(),
		mainFile:  mainFile,
		files:     files,
	}

	select {
	case s.queue <- job:
	default:
		return Job{}, ErrQueueFull
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.jobs[job.ID] = job
	return *job, nil
}

func (s *Service) Get(id string) (Job, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	job, ok := s.jobs[id]
	if !ok {
		return Job{}, false
	}
	return *job, true
}

func (s *Service) worker() {
	for {
		select {
		case <-s.ctx.Done():
			return
		case job := <-s.queue:
			s.run(job)
		}
	}
}

func (s *Service) run(job *Job) {
	s.update(job, func(j *Job) { j.Status = StatusRunning })

	res, err := s.compile(job)
	if err != nil && !errors.Is(err, sandbox.ErrCompileFailed) && !errors.Is(err, context.DeadlineExceeded) {
		log.Printf("job %s: %v", job.ID, err)
	}

	s.update(job, func(j *Job) {
		j.Result = res
		j.Err = err
		j.FinishedAt = time.Now()
		j.files = nil
		if err != nil {
			j.Status = StatusFailed
		} else {
			j.Status = StatusDone
		}
	})

}

func (s *Service) compile(job *Job) (*sandbox.Result, error) {
	srcDir, err := os.MkdirTemp("", "latex-src-*")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(srcDir)

	if err := writeFiles(srcDir, job.files); err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(s.ctx, s.opts.Timeout)
	defer cancel()
	return s.compiler.Compile(ctx, srcDir, job.mainFile)
}

func (s *Service) update(job *Job, fn func(*Job)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	fn(job)
}

// janitor drops finished jobs after JobTTL so memory doesn't grow forever.
func (s *Service) janitor() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-s.ctx.Done():
			return
		case <-ticker.C:
			s.mu.Lock()
			for id, job := range s.jobs {
				if !job.FinishedAt.IsZero() && time.Since(job.FinishedAt) > s.opts.JobTTL {
					delete(s.jobs, id)
				}
			}
			s.mu.Unlock()
		}
	}
}

func validate(mainFile string, files map[string]string) error {
	if len(files) == 0 || len(files) > maxFiles {
		return fmt.Errorf("%w: expected 1-%d files", ErrInvalidRequest, maxFiles)
	}
	if err := sandbox.ValidateMainFile(mainFile); err != nil {
		return fmt.Errorf("%w: %w", ErrInvalidRequest, err)
	}
	if _, ok := files[mainFile]; !ok {
		return fmt.Errorf("%w: main file %q is not in files", ErrInvalidRequest, mainFile)
	}
	for name := range files {
		if !filepath.IsLocal(name) {
			return fmt.Errorf("%w: invalid path %q", ErrInvalidRequest, name)
		}
	}
	return nil
}

func writeFiles(dir string, files map[string]string) error {
	for name, content := range files {
		path := filepath.Join(dir, name)
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			return err
		}
		if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
			return err
		}
	}
	return nil
}
