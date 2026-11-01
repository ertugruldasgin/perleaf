package web

import "embed"

// Dist is the Vite build output, filled by `make build`.
//
//go:embed all:dist
var Dist embed.FS
