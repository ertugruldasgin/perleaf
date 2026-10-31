package sandbox

import (
	"bufio"
	"bytes"
	"regexp"
	"strconv"
	"strings"
)

type LogError struct {
	File    string `json:"file,omitempty"`
	Line    int    `json:"line,omitempty"`
	Message string `json:"message"`
}

var fileLineRe = regexp.MustCompile(`^(.+?\.\w+):(\d+): (.+)$`)

func parseLog(log []byte) []LogError {
	var errs []LogError
	sc := bufio.NewScanner(bytes.NewReader(log))
	for sc.Scan() {
		e, ok := parseLine(sc.Text())
		if !ok || strings.HasPrefix(e.Message, "==>") {
			continue
		}
		errs = append(errs, e)
	}
	return errs
}

func parseLine(line string) (LogError, bool) {
	if m := fileLineRe.FindStringSubmatch(line); m != nil {
		n, _ := strconv.Atoi(m[2])
		return LogError{
			File:    strings.TrimPrefix(m[1], "./"),
			Line:    n,
			Message: strings.TrimSpace(m[3]),
		}, true
	}
	if msg, ok := strings.CutPrefix(line, "! "); ok {
		return LogError{Message: strings.TrimSpace(msg)}, true
	}
	return LogError{}, false
}
