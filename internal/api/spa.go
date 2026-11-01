package api

import (
	"io/fs"
	"net/http"
	"path"
	"strings"
)

// spa serves the frontend build.
// Paths that aren't files (client-side routes like /p/{id}) get index.html so the React router can handle them.
func spa(ui fs.FS) http.Handler {
	files := http.FileServerFS(ui)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			http.NotFound(w, r)
			return
		}
		name := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if name != "" {
			if _, err := fs.Stat(ui, name); err != nil {
				http.ServeFileFS(w, r, ui, "index.html")
				return
			}
		}
		files.ServeHTTP(w, r)
	})
}
