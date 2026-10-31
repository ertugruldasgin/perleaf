package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/ertugruldasgin/latex-editor/internal/api"
	"github.com/ertugruldasgin/latex-editor/internal/compile"
	"github.com/ertugruldasgin/latex-editor/internal/sandbox"
)

var version = "dev"

func main() {
	log.Printf("latex-editor %s", version)

	d, err := sandbox.NewDocker(sandbox.DefaultImage)
	jobs := compile.New(d, compile.Options{
		Workers:   2,
		QueueSize: 32,
		Timeout:   30 * time.Second,
		JobTTL:    10 * time.Minute,
		CacheSize: 100,
		CacheTTL:  30 * time.Minute,
	})
	if err != nil {
		log.Fatal(err)
	}
	defer d.Close()

	addr := os.Getenv("ADDR")
	if addr == "" {
		addr = ":8080"
	}

	srv := &http.Server{
		Addr:              addr,
		Handler:           api.NewRouter(jobs),
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
