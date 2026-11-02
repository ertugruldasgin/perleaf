package api

import (
	"crypto/rand"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/ertugruldasgin/perleaf/internal/auth"
	"github.com/ertugruldasgin/perleaf/internal/store"
)

const inviteTTL = 7 * 24 * time.Hour

func (h *Handler) requireOwner(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if projectFrom(r.Context()).Role != store.RoleOwner {
			writeError(w, http.StatusForbidden, "only the project owner can do this")
			return
		}
		next(w, r)
	}
}

func (h *Handler) listMembers(w http.ResponseWriter, r *http.Request) {
	members, err := h.store.ListMembers(r.Context(), projectFrom(r.Context()).ID)
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, members)
}

func (h *Handler) removeMember(w http.ResponseWriter, r *http.Request) {
	p := projectFrom(r.Context())
	me, _ := auth.UserFrom(r.Context())

	userID, err := strconv.ParseInt(r.PathValue("user"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid user id")
		return
	}
	if userID != me.ID && p.Role != store.RoleOwner {
		writeError(w, http.StatusForbidden, "only the project owner can remove members")
		return
	}
	if userID == me.ID && p.Role == store.RoleOwner {
		writeError(w, http.StatusBadRequest, "the owner can't leave the project")
		return
	}

	err = h.store.RemoveMember(r.Context(), p.ID, userID)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "member not found")
		return
	}
	if err != nil {
		internalError(w, err)
		return
	}
	h.hub.Kick(p.ID, userID)
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) createInvite(w http.ResponseWriter, r *http.Request) {
	me, _ := auth.UserFrom(r.Context())
	token := rand.Text()
	err := h.store.CreateInvite(r.Context(), auth.HashToken(token), projectFrom(r.Context()).ID, me.ID, time.Now().Add(inviteTTL))
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"token": token})
}

func (h *Handler) acceptInvite(w http.ResponseWriter, r *http.Request) {
	me, _ := auth.UserFrom(r.Context())
	projectID, err := h.store.AcceptInvite(r.Context(), auth.HashToken(r.PathValue("token")), me.ID)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "this invite link is invalid or has expired")
		return
	}
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"projectId": projectID})
}
