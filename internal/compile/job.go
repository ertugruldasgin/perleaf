package compile

import (
	"time"

	"github.com/ertugruldasgin/perleaf/internal/sandbox"
)

type Status string

const (
	StatusQueued  Status = "queued"
	StatusRunning Status = "running"
	StatusDone    Status = "done"
	StatusFailed  Status = "failed"
)

type Job struct {
	ID         string
	ProjectID  string
	Status     Status
	CreatedAt  time.Time
	FinishedAt time.Time

	Result *sandbox.Result // PDF on success, Log/Errors on failure
	Err    error

	mainFile string
	files    map[string]string // released after compile
	assets   map[string]string // path -> blob hash

	cacheKey string
}
