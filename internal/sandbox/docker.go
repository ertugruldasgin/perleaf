package sandbox

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/moby/moby/api/types/container"
	"github.com/moby/moby/client"
)

const DefaultImage = "texlive/texlive:latest"

type Docker struct {
	cli   *client.Client
	image string
}

func NewDocker(image string) (*Docker, error) {
	cli, err := client.New(client.FromEnv)
	if err != nil {
		return nil, fmt.Errorf("docker client: %w", err)
	}
	return &Docker{cli: cli, image: image}, nil
}

func (d *Docker) Close() error {
	return d.cli.Close()
}

func (d *Docker) Compile(ctx context.Context, srcDir, mainFile string) (*Result, error) {
	if err := ValidateMainFile(mainFile); err != nil {
		return nil, err
	}

	absSrc, err := filepath.Abs(srcDir)
	if err != nil {
		return nil, err
	}

	outDir, err := os.MkdirTemp("", "latex-out-*")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(outDir)

	pidsLimit := int64(256)
	created, err := d.cli.ContainerCreate(ctx, client.ContainerCreateOptions{
		Image: d.image,
		Config: &container.Config{
			Cmd:        latexmkArgs("/out", mainFile),
			WorkingDir: "/src",
			User:       fmt.Sprintf("%d:%d", os.Getuid(), os.Getgid()),
			Env:        []string{"HOME=/tmp", "TEXMFVAR=/tmp/texmf-var", "max_print_line=10000"},
			Tty:        true,
		},
		HostConfig: &container.HostConfig{
			Binds: []string{
				absSrc + ":/src:ro,z",
				outDir + ":/out:z",
			},
			NetworkMode:    "none",
			ReadonlyRootfs: true,
			Tmpfs:          map[string]string{"/tmp": "rw,size=64m"},
			CapDrop:        []string{"ALL"},
			SecurityOpt:    []string{"no-new-privileges"},
			Memory:         512 * 1024 * 1024,
			NanoCPUs:       1_000_000_000,
			PidsLimit:      &pidsLimit,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("create container: %w", err)
	}
	defer d.remove(created.ID)

	if _, err := d.cli.ContainerStart(ctx, created.ID, client.ContainerStartOptions{}); err != nil {
		return nil, fmt.Errorf("start container: %w", err)
	}

	wait := d.cli.ContainerWait(ctx, created.ID, client.ContainerWaitOptions{Condition: container.WaitConditionNotRunning})

	var runErr error
	var output []byte
	select {
	case res := <-wait.Result:
		if res.StatusCode != 0 {
			runErr = fmt.Errorf("%w: latexmk exited with code %d", ErrCompileFailed, res.StatusCode)
			output = d.output(created.ID)
		}
	case err := <-wait.Error:
		return nil, fmt.Errorf("wait container: %w", err)
	}

	return collect(outDir, mainFile, runErr, output)
}

// remove uses its own context: ctx may already be cancelled after a timeout,
// and the container still has to be killed and removed.
func (d *Docker) remove(id string) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_, _ = d.cli.ContainerRemove(ctx, id, client.ContainerRemoveOptions{Force: true})
}

func (d *Docker) output(id string) []byte {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	logs, err := d.cli.ContainerLogs(ctx, id, client.ContainerLogsOptions{ShowStdout: true, ShowStderr: true})
	if err != nil {
		return nil
	}
	defer logs.Close()

	out, _ := io.ReadAll(logs)
	return out
}
