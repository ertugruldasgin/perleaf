.PHONY: run build test check fmt clean

ENV := set -a; [ -f .env ] && . ./.env; set +a;
VERSION := $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)
LDFLAGS := -s -w -X main.version=$(VERSION)

run:
	$(ENV) go run ./cmd/server

build:
	go build -ldflags "$(LDFLAGS)" -o bin/server ./cmd/server

test:
	go test ./...

check:
	@test -z "$$(gofmt -l .)" || (echo "unformatted files:"; gofmt -l .; echo "run: make fmt"; exit 1)
	go vet ./...
	go test ./...

fmt:
	gofmt -w .

clean:
	rm -rf bin/
