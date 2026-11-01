package api

import (
	"bufio"
	"errors"
	"net/http"
)

const maxBlobBytes = 20 << 20 // 20 MB

// pdflatex can include these; anything else (HTML, SVG...) is rejected.
var allowedTypes = map[string]bool{
	"image/png":       true,
	"image/jpeg":      true,
	"application/pdf": true,
}

func (h *Handler) uploadBlob(w http.ResponseWriter, r *http.Request) {
	body := bufio.NewReader(http.MaxBytesReader(w, r.Body, maxBlobBytes))

	head, _ := body.Peek(512)
	if !allowedTypes[http.DetectContentType(head)] {
		writeError(w, http.StatusUnsupportedMediaType, "only PNG, JPEG and PDF files are allowed")
		return
	}

	hash, err := h.blobs.Put(body)
	if err != nil {
		if _, ok := errors.AsType[*http.MaxBytesError](err); ok {
			writeError(w, http.StatusRequestEntityTooLarge, "file is larger than 20 MB")
			return
		}
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"hash": hash})
}

func (h *Handler) getBlob(w http.ResponseWriter, r *http.Request) {
	path, err := h.blobs.Path(r.PathValue("hash"))
	if err != nil {
		writeError(w, http.StatusNotFound, "blob not found")
		return
	}
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	http.ServeFile(w, r, path)
}
