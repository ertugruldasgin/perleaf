package api

import (
	"context"
	"net/http"

	"github.com/ertugruldasgin/latex-editor/internal/sandbox"
)

type Compiler interface {
	Compile(ctx context.Context, srcDir, mainFile string) (*sandbox.Result, error)
}

type Handler struct {
	compiler Compiler
}

func NewRouter(c Compiler) http.Handler {
	h := &Handler{compiler: c}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", h.healthz)
	mux.HandleFunc("POST /compile", h.compile)
	return mux
}

func (h *Handler) healthz(w http.ResponseWriter, r *http.Request) {
	w.Write([]byte("ok"))
}
