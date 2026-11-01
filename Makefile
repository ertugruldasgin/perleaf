.PHONY: run run-server run-web build build-web test check fmt clean

ENV := set -a; [ -f .env ] && . ./.env; set +a;
VERSION := $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)
LDFLAGS := -s -w -X main.version=$(VERSION)

# make run -> go server + vite dev server together
run:
	$(MAKE) -j2 run-server run-web

run-server:
	$(ENV) go run ./cmd/server

run-web:
	cd web && npm run dev

# make build -> frontend into web/dist, then one binary with it embedded
build: build-web
	go build -ldflags "$(LDFLAGS)" -o bin/server ./cmd/server

build-web:
	cd web && npm ci && npm run build
	touch web/dist/.gitkeep

test:
	go test ./...

check:
	@test -z "$$(gofmt -l .)" || (echo "unformatted files:"; gofmt -l .; echo "run: make fmt"; exit 1)
	go vet ./...
	go test ./...
	cd web && npm run lint

fmt:
	gofmt -w .

clean:
	rm -rf bin/
	find web/dist -mindepth 1 ! -name .gitkeep -delete
