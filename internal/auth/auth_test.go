package auth

import "testing"

func TestSafeNext(t *testing.T) {
	tests := map[string]string{
		"":                    "/",
		"/p/ABC":              "/p/ABC",
		"/invite/XYZ?a=1":     "/invite/XYZ?a=1",
		"https://evil.com":    "/",
		"//evil.com":          "/",
		`/\evil.com`:          "/",
		"evil.com":            "/",
		"javascript:alert(1)": "/",
	}
	for in, want := range tests {
		if got := safeNext(in); got != want {
			t.Errorf("safeNext(%q) = %q, want %q", in, got, want)
		}
	}
}
