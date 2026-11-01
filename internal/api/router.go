package api

import (
	"io/fs"
	"net/http"

	"github.com/ertugruldasgin/latex-editor/internal/auth"
	"github.com/ertugruldasgin/latex-editor/internal/blob"
	"github.com/ertugruldasgin/latex-editor/internal/collab"
	"github.com/ertugruldasgin/latex-editor/internal/compile"
	"github.com/ertugruldasgin/latex-editor/internal/store"
)

type Deps struct {
	Jobs  *compile.Service
	Hub   *collab.Hub
	Blobs *blob.Store
	Store *store.Store
	Auth  *auth.Auth
	UI    fs.FS
}

type Handler struct {
	jobs  *compile.Service
	blobs *blob.Store
	store *store.Store
}

func NewRouter(d Deps) http.Handler {
	h := &Handler{jobs: d.Jobs, blobs: d.Blobs, store: d.Store}

	user := func(next http.HandlerFunc) http.Handler { return d.Auth.Require(next) }
	member := func(next http.HandlerFunc) http.Handler { return d.Auth.Require(h.requireMember(next)) }

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", h.healthz)

	mux.HandleFunc("GET /auth/login", d.Auth.Login)
	mux.HandleFunc("GET /auth/callback", d.Auth.Callback)
	mux.HandleFunc("POST /auth/logout", d.Auth.Logout)
	mux.Handle("GET /api/me", user(d.Auth.Me))

	mux.Handle("GET /api/projects", user(h.listProjects))
	mux.Handle("POST /api/projects", user(h.createProject))
	mux.Handle("GET /api/projects/{project}", member(h.getProject))
	mux.Handle("POST /api/projects/{project}/compile", member(h.submit))
	mux.Handle("GET /api/projects/{project}/jobs/{id}", member(h.getJob))
	mux.Handle("GET /api/projects/{project}/jobs/{id}/pdf", member(h.getPDF))
	mux.Handle("POST /api/projects/{project}/blobs", member(h.uploadBlob))
	mux.Handle("GET /api/projects/{project}/blobs/{hash}", member(h.getBlob))
	mux.Handle("GET /ws/{project}", member(d.Hub.ServeWS))

	mux.Handle("GET /", spa(d.UI))
	return mux
}

func (h *Handler) healthz(w http.ResponseWriter, r *http.Request) {
	w.Write([]byte("ok"))
}
