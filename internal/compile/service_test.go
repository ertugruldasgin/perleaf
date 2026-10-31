package compile

import "testing"

func TestCacheKey(t *testing.T) {
	a := cacheKey("main.tex", map[string]string{"main.tex": "x", "b.tex": "y"})
	b := cacheKey("main.tex", map[string]string{"b.tex": "y", "main.tex": "x"})
	if a != b {
		t.Error("same content should give the same key regardless of map order")
	}

	c := cacheKey("main.tex", map[string]string{"main.tex": "x", "b.tex": "z"})
	if a == c {
		t.Error("different content should give a different key")
	}

	// without length prefixes these two would hash the same bytes: "abc"
	d := cacheKey("main.tex", map[string]string{"a": "bc"})
	e := cacheKey("main.tex", map[string]string{"ab": "c"})
	if d == e {
		t.Error("name/content boundary must be part of the key")
	}
}
