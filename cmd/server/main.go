package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/ertugruldasgin/latex-editor/internal/sandbox"
)

var version = "dev"

func main() {
	fmt.Printf("latex-editor: %s\n", version)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	res, err := sandbox.CompileLocal(ctx, "testdata", "hello.tex")
	if err != nil {
		log.Fatal(err)
	}

	if err := os.MkdirAll("out", 0o755); err != nil {
		log.Fatal(err)
	}

	if err := os.WriteFile("out/hello.pdf", res.PDF, 0o644); err != nil {
		log.Fatal(err)
	}

	fmt.Printf("ok: %d bytes -> out/hello.pdf\n", len(res.PDF))
}
