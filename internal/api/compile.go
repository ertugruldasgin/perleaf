package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/ertugruldasgin/latex-editor/internal/sandbox"
)

const (
	maxRequestBytes = 10 << 20 // 10 MB
	maxFiles        = 200
	compileTimeout  = 30 * time.Second
)

var errInvalidPath = errors.New("invalid file path")

type compileRequest struct {
	Main  string            `json:"main"`
	Files map[string]string `json:"files"`
}

type errorResponse struct {
	Error  string             `json:"error"`
	Errors []sandbox.LogError `json:"errors,omitempty"`
	Log    string             `json:"log,omitempty"`
}

func (h *Handler) compile(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBytes)

	var req compileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error(), nil)
		return
	}
	if len(req.Files) == 0 || len(req.Files) > maxFiles {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("files: expected 1-%d entries", maxFiles), nil)
		return
	}
	if _, ok := req.Files[req.Main]; !ok {
		writeError(w, http.StatusBadRequest, "main file is not in files", nil)
		return
	}

	srcDir, err := os.MkdirTemp("", "latex-src-*")
	if err != nil {
		internalError(w, err)
		return
	}
	defer os.RemoveAll(srcDir)

	if err := writeFiles(srcDir, req.Files); err != nil {
		if errors.Is(err, errInvalidPath) {
			writeError(w, http.StatusBadRequest, err.Error(), nil)
			return
		}
		internalError(w, err)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), compileTimeout)
	defer cancel()

	res, err := h.compiler.Compile(ctx, srcDir, req.Main)
	switch {
	case err == nil:
		w.Header().Set("Content-Type", "application/pdf")
		w.Write(res.PDF)
	case errors.Is(err, sandbox.ErrInvalidMainFile):
		writeError(w, http.StatusBadRequest, err.Error(), nil)
	case errors.Is(err, sandbox.ErrCompileFailed):
		writeJSON(w, http.StatusUnprocessableEntity, errorResponse{
			Error:  "compile failed",
			Errors: res.Errors,
			Log:    string(res.Log),
		})
	case errors.Is(err, context.DeadlineExceeded):
		writeError(w, http.StatusUnprocessableEntity, "compile timed out", nil)
	case errors.Is(err, context.Canceled):
		// client disconnected, nobody to answer
	default:
		internalError(w, err)
	}

}

// writeFiles writes the request files into dir, rejecting paths that escape it.
func writeFiles(dir string, files map[string]string) error {
	for name, content := range files {
		if !filepath.IsLocal(name) {
			return fmt.Errorf("%w: %q", errInvalidPath, name)
		}
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

func writeError(w http.ResponseWriter, status int, msg string, logData []byte) {
	writeJSON(w, status, errorResponse{Error: msg, Log: string(logData)})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func internalError(w http.ResponseWriter, err error) {
	log.Printf("internal error: %v", err)
	writeError(w, http.StatusInternalServerError, "internal error", nil)
}
