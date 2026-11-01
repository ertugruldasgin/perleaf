package api

import (
	"io/fs"
	"net/http"

	"github.com/ertugruldasgin/latex-editor/internal/blob"
	"github.com/ertugruldasgin/latex-editor/internal/collab"
	"github.com/ertugruldasgin/latex-editor/internal/compile"
)

type Handler struct {
	jobs  *compile.Service
	blobs *blob.Store
}

func NewRouter(jobs *compile.Service, hub *collab.Hub, blobs *blob.Store, ui fs.FS) http.Handler {
	h := &Handler{jobs: jobs, blobs: blobs}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", h.healthz)
	mux.HandleFunc("POST /compile", h.submit)
	mux.HandleFunc("GET /jobs/{id}", h.getJob)
	mux.HandleFunc("GET /jobs/{id}/pdf", h.getPDF)
	mux.HandleFunc("POST /blobs", h.uploadBlob)
	mux.HandleFunc("GET /blobs/{hash}", h.getBlob)
	mux.HandleFunc("GET /ws/{project}", hub.ServeWS)
	mux.Handle("GET /", http.FileServerFS(ui))
	return mux
}

func (h *Handler) healthz(w http.ResponseWriter, r *http.Request) {
	w.Write([]byte("ok"))
}
