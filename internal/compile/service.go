package compile

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"log"
	"maps"
	"os"
	"path/filepath"
	"slices"
	"sync"
	"time"

	"github.com/ertugruldasgin/perleaf/internal/sandbox"
	"github.com/hashicorp/golang-lru/v2/expirable"
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

type Blobs interface {
	Path(hash string) (string, error)
}

type Options struct {
	Workers   int
	QueueSize int
	Timeout   time.Duration
	JobTTL    time.Duration
	CacheSize int
	CacheTTL  time.Duration
}

type Service struct {
	compiler Compiler
	blobs    Blobs
	opts     Options
	queue    chan *Job

	mu   sync.Mutex
	jobs map[string]*Job

	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup

	cache *expirable.LRU[string, *sandbox.Result]
}

func New(c Compiler, blobs Blobs, opts Options) *Service {
	ctx, cancel := context.WithCancel(context.Background())
	s := &Service{
		compiler: c,
		blobs:    blobs,
		opts:     opts,
		queue:    make(chan *Job, opts.QueueSize),
		jobs:     make(map[string]*Job),
		ctx:      ctx,
		cancel:   cancel,
		cache:    expirable.NewLRU[string, *sandbox.Result](opts.CacheSize, nil, opts.CacheTTL),
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

func (s *Service) Submit(projectID, mainFile string, files, assets map[string]string) (Job, error) {
	if s.ctx.Err() != nil {
		return Job{}, ErrStopped
	}
	if err := s.validate(mainFile, files, assets); err != nil {
		return Job{}, err
	}

	key := cacheKey(mainFile, files, assets)
	if res, ok := s.cache.Get(key); ok {
		now := time.Now()
		return s.register(&Job{
			ID:         rand.Text(),
			ProjectID:  projectID,
			Status:     StatusDone,
			CreatedAt:  now,
			FinishedAt: now,
			Result:     res,
		}), nil
	}

	job := &Job{
		ID:        rand.Text(),
		ProjectID: projectID,
		Status:    StatusQueued,
		CreatedAt: time.Now(),
		mainFile:  mainFile,
		files:     files,
		assets:    assets,
		cacheKey:  key,
	}

	select {
	case s.queue <- job:
	default:
		return Job{}, ErrQueueFull
	}
	return s.register(job), nil
}

func (s *Service) register(job *Job) Job {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.jobs[job.ID] = job
	return *job
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
	if err == nil {
		s.cache.Add(job.cacheKey, res)
	}
	if err != nil && !errors.Is(err, sandbox.ErrCompileFailed) && !errors.Is(err, context.DeadlineExceeded) {
		log.Printf("job %s: %v", job.ID, err)
	}

	s.update(job, func(j *Job) {
		j.Result = res
		j.Err = err
		j.FinishedAt = time.Now()
		j.files = nil
		j.assets = nil
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

	if err := s.copyAssets(srcDir, job.assets); err != nil {
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

func (s *Service) validate(mainFile string, files, assets map[string]string) error {
	if len(files) == 0 || len(files)+len(assets) > maxFiles {
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
	for name, hash := range assets {
		if !filepath.IsLocal(name) {
			return fmt.Errorf("%w: invalid path %q", ErrInvalidRequest, name)
		}
		if _, ok := files[name]; ok {
			return fmt.Errorf("%w: %q is both a text file and an asset", ErrInvalidRequest, name)
		}
		if _, err := s.blobs.Path(hash); err != nil {
			return fmt.Errorf("%w: unknown asset %q", ErrInvalidRequest, name)
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

func (s *Service) copyAssets(dir string, assets map[string]string) error {
	for name, hash := range assets {
		src, err := s.blobs.Path(hash)
		if err != nil {
			return err
		}
		if err := copyFile(src, filepath.Join(dir, name)); err != nil {
			return err
		}
	}
	return nil
}

func copyFile(src, dst string) error {
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return err
	}
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		return err
	}
	return out.Close()
}

// cacheKey hashes the main file, the text files and the asset hashes, all sorted by name.
func cacheKey(mainFile string, files, assets map[string]string) string {
	h := sha256.New()
	fmt.Fprintf(h, "%d:%s", len(mainFile), mainFile)
	writeMap(h, files)
	writeMap(h, assets)
	return hex.EncodeToString(h.Sum(nil))
}

func writeMap(w io.Writer, m map[string]string) {
	fmt.Fprintf(w, "%d;", len(m))
	for _, k := range slices.Sorted(maps.Keys(m)) {
		v := m[k]
		fmt.Fprintf(w, "%d:%s%d:%s", len(k), k, len(v), v)
	}
}
