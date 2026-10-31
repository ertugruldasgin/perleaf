package sandbox

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

type Result struct {
	PDF []byte
	Log []byte
}

// CompileLocal runs latexmk on the local. Docker version comes later.
func CompileLocal(ctx context.Context, srcDir, mainFile string) (*Result, error) {
	if err := validateMainFile(mainFile); err != nil {
		return nil, err
	}

	outDir, err := os.MkdirTemp("", "latex-out-*")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(outDir)

	cmd := exec.CommandContext(ctx, "latexmk", "-pdf", "-interaction=nonstopmode", "-halt-on-error", "-no-shell-escape", "-outdir="+outDir, mainFile)
	cmd.Dir = srcDir
	output, runErr := cmd.CombinedOutput()

	base := strings.TrimSuffix(filepath.Base(mainFile), filepath.Ext(mainFile))
	logData, _ := os.ReadFile(filepath.Join(outDir, base+".log"))
	if runErr != nil {
		return &Result{Log: logData}, fmt.Errorf("latexmk: %w\n%s", runErr, output)
	}

	pdf, err := os.ReadFile(filepath.Join(outDir, base+".pdf"))
	if err != nil {
		return &Result{Log: logData}, fmt.Errorf("read pdf: %w", err)
	}

	return &Result{PDF: pdf, Log: logData}, nil
}

var ErrInvalidMainFile = errors.New("invalid main file")

func validateMainFile(name string) error {
	if !filepath.IsLocal(name) {
		return fmt.Errorf("%w: %q must be a relative path inside the project", ErrInvalidMainFile, name)
	}
	if strings.HasPrefix(name, "-") {
		return fmt.Errorf("%w: %q must not start with '-'", ErrInvalidMainFile, name)
	}
	if filepath.Ext(name) != ".tex" {
		return fmt.Errorf("%w: %q must have .tex extension", ErrInvalidMainFile, name)
	}
	return nil
}
