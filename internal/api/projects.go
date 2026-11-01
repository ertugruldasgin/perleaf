package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/ertugruldasgin/latex-editor/internal/auth"
	"github.com/ertugruldasgin/latex-editor/internal/store"
)

type projectKey struct{}

func (h *Handler) requireMember(next http.HandlerFunc) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, _ := auth.UserFrom(r.Context())
		p, err := h.store.ProjectForMember(r.Context(), r.PathValue("project"), user.ID)
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "project not found")
			return
		}
		if err != nil {
			internalError(w, err)
			return
		}
		next(w, r.WithContext(context.WithValue(r.Context(), projectKey{}, p)))
	})
}

func projectFrom(ctx context.Context) store.Project {
	p, _ := ctx.Value(projectKey{}).(store.Project)
	return p
}

func (h *Handler) listProjects(w http.ResponseWriter, r *http.Request) {
	user, _ := auth.UserFrom(r.Context())
	projects, err := h.store.ListProjects(r.Context(), user.ID)
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, projects)
}

func (h *Handler) createProject(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<10)).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" || utf8.RuneCountInString(name) > 100 {
		writeError(w, http.StatusBadRequest, "name must be 1-100 characters")
		return
	}

	user, _ := auth.UserFrom(r.Context())
	p, err := h.store.CreateProject(r.Context(), name, user.ID)
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, p)
}

func (h *Handler) getProject(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, projectFrom(r.Context()))
}
