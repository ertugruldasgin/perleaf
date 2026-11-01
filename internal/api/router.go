package api

import (
	"net/http"

	"github.com/ertugruldasgin/latex-editor/internal/collab"
	"github.com/ertugruldasgin/latex-editor/internal/compile"
)

type Handler struct {
	jobs *compile.Service
}

func NewRouter(jobs *compile.Service, hub *collab.Hub) http.Handler {
	h := &Handler{jobs: jobs}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", h.healthz)
	mux.HandleFunc("POST /compile", h.submit)
	mux.HandleFunc("GET /jobs/{id}", h.getJob)
	mux.HandleFunc("GET /jobs/{id}/pdf", h.getPDF)
	mux.HandleFunc("GET /ws/{project}", hub.ServeWS)
	return mux
}

func (h *Handler) healthz(w http.ResponseWriter, r *http.Request) {
	w.Write([]byte("ok"))
}
