package main

import (
	"context"
	"errors"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/ertugruldasgin/latex-editor/internal/api"
	"github.com/ertugruldasgin/latex-editor/internal/collab"
	"github.com/ertugruldasgin/latex-editor/internal/compile"
	"github.com/ertugruldasgin/latex-editor/internal/sandbox"
	"github.com/ertugruldasgin/latex-editor/internal/store"
	"github.com/ertugruldasgin/latex-editor/web"
)

var version = "dev"

func main() {
	log.Printf("latex-editor %s", version)

	d, err := sandbox.NewDocker(sandbox.DefaultImage)
	if err != nil {
		log.Fatal(err)
	}
	defer d.Close()

	jobs := compile.New(d, compile.Options{
		Workers:   2,
		QueueSize: 32,
		Timeout:   30 * time.Second,
		JobTTL:    10 * time.Minute,
		CacheSize: 100,
		CacheTTL:  30 * time.Minute,
	})

	dataDir := os.Getenv("DATA_DIR")
	if dataDir == "" {
		dataDir = "data"
	}
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		log.Fatal(err)
	}
	st, err := store.Open(filepath.Join(dataDir, "latex-editor.db"))
	if err != nil {
		log.Fatal(err)
	}
	defer st.Close()

	hub := collab.NewHub(st)
	ui, err := fs.Sub(web.Dist, "dist")
	if err != nil {
		log.Fatal(err)
	}
	addr := os.Getenv("ADDR")
	if addr == "" {
		addr = ":8080"
	}

	srv := &http.Server{
		Addr:              addr,
		Handler:           api.NewRouter(jobs, hub, ui),
		ReadHeaderTimeout: 5 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		log.Printf("listening on %s", addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatal(err)
		}
	}()

	<-ctx.Done()
	log.Print("shutting down")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("shutdown: %v", err)
	}
	jobs.Stop()
}
