package sandbox

import "testing"

func TestParseLog(t *testing.T) {
	log := []byte(`(./broken.tex
./broken.tex:3: Undefined control sequence.
l.3 \undefinedcommand
./chapters/intro.tex:12: LaTeX Error: File ` + "`foo.sty'" + ` not found.
./broken.tex:3:  ==> Fatal error occurred, no output PDF file produced!
! Emergency stop.
!  ==> Fatal error occurred, no output PDF file produced!
`)
	got := parseLog(log)
	want := []LogError{
		{File: "broken.tex", Line: 3, Message: "Undefined control sequence."},
		{File: "chapters/intro.tex", Line: 12, Message: "LaTeX Error: File `foo.sty' not found."},
		{Message: "Emergency stop."},
	}
	if len(got) != len(want) {
		t.Fatalf("got %d errors, want %d: %+v", len(got), len(want), got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("error %d: got %+v, want %+v", i, got[i], want[i])
		}
	}
}
