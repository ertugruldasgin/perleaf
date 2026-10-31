package sandbox

import (
	"errors"
	"testing"
)

func TestValidateMainFile(t *testing.T) {
	tests := []struct {
		name string
		ok   bool
	}{
		{"main.tex", true},
		{"chapters/main.tex", true},
		{"", false},
		{"/etc/passwd.tex", false},
		{"../secret.tex", false},
		{"-shell-escape", false},
		{"-x.tex", false},
		{"main.txt", false},
	}
	for _, tt := range tests {
		err := ValidateMainFile(tt.name)
		if tt.ok && err != nil {
			t.Errorf("%q: unexpected error: %v", tt.name, err)
		}
		if !tt.ok && !errors.Is(err, ErrInvalidMainFile) {
			t.Errorf("%q: expected ErrInvalidMainFile, got %v", tt.name, err)
		}
	}
}
