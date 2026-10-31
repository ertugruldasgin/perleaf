package sandbox

import (
	"context"
	"fmt"
	"os"
	"os/exec"
)

// CompileLocal runs latexmk on the local.
func CompileLocal(ctx context.Context, srcDir, mainFile string) (*Result, error) {
	if err := validateMainFile(mainFile); err != nil {
		return nil, err
	}

	outDir, err := os.MkdirTemp("", "latex-out-*")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(outDir)

	args := latexmkArgs(outDir, mainFile)
	cmd := exec.CommandContext(ctx, args[0], args[1:]...)
	cmd.Dir = srcDir
	output, runErr := cmd.CombinedOutput()
	if runErr != nil {
		runErr = fmt.Errorf("latexmk: %w", runErr)
	}

	return collect(outDir, mainFile, runErr, output)
}
