package sandbox

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type Result struct {
	PDF    []byte
	Log    []byte
	Errors []LogError
}

var ErrInvalidMainFile = errors.New("invalid main file")
var ErrCompileFailed = errors.New("compile failed")

func ValidateMainFile(name string) error {
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

func latexmkArgs(outDir, mainFile string) []string {
	return []string{
		"latexmk",
		"-pdf",
		"-interaction=nonstopmode",
		"-halt-on-error",
		"-file-line-error",
		"-no-shell-escape",
		"-outdir=" + outDir,
		mainFile,
	}
}

func collect(outDir, mainFile string, runErr error, output []byte) (*Result, error) {
	base := strings.TrimSuffix(filepath.Base(mainFile), filepath.Ext(mainFile))
	logData, _ := os.ReadFile(filepath.Join(outDir, base+".log"))
	if runErr != nil {
		return &Result{Log: logData, Errors: parseLog(logData)}, fmt.Errorf("%w\n%s", runErr, output)
	}

	pdf, err := os.ReadFile(filepath.Join(outDir, base+".pdf"))
	if err != nil {
		return &Result{Log: logData}, fmt.Errorf("read pdf: %w", err)
	}
	return &Result{PDF: pdf, Log: logData}, nil
}
