package api

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"

	"github.com/ertugruldasgin/latex-editor/internal/compile"
	"github.com/ertugruldasgin/latex-editor/internal/sandbox"
)

const maxRequestBytes = 10 << 20 // 10 MB

type compileRequest struct {
	Main   string            `json:"main"`
	Files  map[string]string `json:"files"`
	Assets map[string]string `json:"assets"`
}

type jobResponse struct {
	ID     string             `json:"id"`
	Status compile.Status     `json:"status"`
	Error  string             `json:"error,omitempty"`
	Errors []sandbox.LogError `json:"errors,omitempty"`
	Log    string             `json:"log,omitempty"`
}

func (h *Handler) submit(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBytes)

	var req compileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}

	job, err := h.jobs.Submit(req.Main, req.Files, req.Assets)
	switch {
	case errors.Is(err, compile.ErrInvalidRequest):
		writeError(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, compile.ErrQueueFull):
		w.Header().Set("Retry-After", "5")
		writeError(w, http.StatusTooManyRequests, err.Error())
	case errors.Is(err, compile.ErrStopped):
		writeError(w, http.StatusServiceUnavailable, err.Error())
	case err != nil:
		internalError(w, err)
	default:
		w.Header().Set("Location", "/jobs/"+job.ID)
		status := http.StatusAccepted
		if job.Status == compile.StatusDone {
			status = http.StatusOK
		}
		writeJSON(w, status, toJobResponse(job))
	}
}

func (h *Handler) getJob(w http.ResponseWriter, r *http.Request) {
	job, ok := h.jobs.Get(r.PathValue("id"))
	if !ok {
		writeError(w, http.StatusNotFound, "job not found")
		return
	}
	writeJSON(w, http.StatusOK, toJobResponse(job))
}

func (h *Handler) getPDF(w http.ResponseWriter, r *http.Request) {
	job, ok := h.jobs.Get(r.PathValue("id"))
	if !ok {
		writeError(w, http.StatusNotFound, "job not found")
		return
	}
	if job.Status != compile.StatusDone {
		writeError(w, http.StatusConflict, "job is "+string(job.Status))
		return
	}
	w.Header().Set("Content-Type", "application/pdf")
	w.Write(job.Result.PDF)
}

func toJobResponse(j compile.Job) jobResponse {
	resp := jobResponse{ID: j.ID, Status: j.Status}
	if j.Status != compile.StatusFailed {
		return resp
	}
	switch {
	case errors.Is(j.Err, sandbox.ErrCompileFailed):
		resp.Error = "compile failed"
	case errors.Is(j.Err, context.DeadlineExceeded):
		resp.Error = "compile timed out"
	default:
		resp.Error = "internal error"
	}
	if j.Result != nil {
		resp.Errors = j.Result.Errors
		resp.Log = string(j.Result.Log)
	}
	return resp
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func internalError(w http.ResponseWriter, err error) {
	log.Printf("internal error: %v", err)
	writeError(w, http.StatusInternalServerError, "internal error")
}
