package api

import (
	"io/fs"
	"net/http"

	"github.com/ertugruldasgin/perleaf/internal/auth"
	"github.com/ertugruldasgin/perleaf/internal/blob"
	"github.com/ertugruldasgin/perleaf/internal/collab"
	"github.com/ertugruldasgin/perleaf/internal/compile"
	"github.com/ertugruldasgin/perleaf/internal/store"
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
	hub   *collab.Hub
}

func NewRouter(d Deps) http.Handler {
	h := &Handler{jobs: d.Jobs, blobs: d.Blobs, store: d.Store, hub: d.Hub}

	user := func(next http.HandlerFunc) http.Handler { return d.Auth.Require(next) }
	member := func(next http.HandlerFunc) http.Handler { return d.Auth.Require(h.requireMember(next)) }
	owner := func(next http.HandlerFunc) http.Handler { return member(h.requireOwner(next)) }

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", h.healthz)

	mux.HandleFunc("GET /auth/login", d.Auth.Login)
	mux.HandleFunc("GET /auth/callback", d.Auth.Callback)
	mux.HandleFunc("POST /auth/logout", d.Auth.Logout)
	mux.Handle("GET /api/me", user(d.Auth.Me))

	mux.Handle("GET /api/projects", user(h.listProjects))
	mux.Handle("POST /api/projects", user(h.createProject))
	mux.Handle("PATCH /api/projects/{project}", owner(h.renameProject))
	mux.Handle("DELETE /api/projects/{project}", owner(h.deleteProject))
	mux.Handle("GET /api/projects/{project}", member(h.getProject))
	mux.Handle("POST /api/projects/{project}/compile", member(h.submit))
	mux.Handle("GET /api/projects/{project}/jobs/{id}", member(h.getJob))
	mux.Handle("GET /api/projects/{project}/jobs/{id}/pdf", member(h.getPDF))
	mux.Handle("POST /api/projects/{project}/blobs", member(h.uploadBlob))
	mux.Handle("GET /api/projects/{project}/blobs/{hash}", member(h.getBlob))
	mux.Handle("GET /ws/{project}", member(d.Hub.ServeWS))

	mux.Handle("GET /api/projects/{project}/members", member(h.listMembers))
	mux.Handle("DELETE /api/projects/{project}/members/{user}", member(h.removeMember))
	mux.Handle("POST /api/projects/{project}/invites", owner(h.createInvite))
	mux.Handle("POST /api/invites/{token}/accept", user(h.acceptInvite))

	mux.Handle("GET /", spa(d.UI))
	return mux
}

func (h *Handler) healthz(w http.ResponseWriter, r *http.Request) {
	w.Write([]byte("ok"))
}
