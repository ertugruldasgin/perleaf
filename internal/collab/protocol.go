package collab

import "encoding/binary"

// y-websocket message types
const (
	msgSync      = 0
	msgAwareness = 1

	syncStep1  = 0
	syncStep2  = 1
	syncUpdate = 2
)

var emptyUpdate = []byte{0, 0}

func readVarUint(b []byte) (uint64, []byte, bool) {
	v, n := binary.Uvarint(b)
	if n <= 0 {
		return 0, nil, false
	}
	return v, b[n:], true
}

func readVarBytes(b []byte) ([]byte, bool) {
	n, rest, ok := readVarUint(b)
	if !ok || uint64(len(rest)) < n {
		return nil, false
	}
	return rest[:n], true
}

func syncMessage(syncType uint64, payload []byte) []byte {
	b := binary.AppendUvarint(nil, msgSync)
	b = binary.AppendUvarint(b, syncType)
	b = binary.AppendUvarint(b, uint64(len(payload)))
	return append(b, payload...)
}
