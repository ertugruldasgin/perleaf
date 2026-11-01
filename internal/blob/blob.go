package blob

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"os"
	"path/filepath"
)

var ErrNotFound = errors.New("blob not found")

// Store keeps files on disk under the sha256 of their content.
type Store struct {
	dir string
}

func Open(dir string) (*Store, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	return &Store{dir: dir}, nil
}

// Put saves the content of r and returns its hash. Saving the same content twice keeps one copy.
func (s *Store) Put(r io.Reader) (string, error) {
	tmp, err := os.CreateTemp(s.dir, "upload-*")
	if err != nil {
		return "", err
	}
	defer os.Remove(tmp.Name())

	h := sha256.New()
	if _, err := io.Copy(io.MultiWriter(tmp, h), r); err != nil {
		tmp.Close()
		return "", err
	}
	if err := tmp.Close(); err != nil {
		return "", err
	}

	hash := hex.EncodeToString(h.Sum(nil))
	dst := s.path(hash)
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return "", err
	}
	if err := os.Rename(tmp.Name(), dst); err != nil {
		return "", err
	}
	return hash, nil
}

// Path returns where a stored blob is on disk.
func (s *Store) Path(hash string) (string, error) {
	if !validHash(hash) {
		return "", ErrNotFound
	}
	p := s.path(hash)
	if _, err := os.Stat(p); err != nil {
		return "", ErrNotFound
	}
	return p, nil
}

func (s *Store) path(hash string) string {
	return filepath.Join(s.dir, hash[:2], hash)
}

func validHash(h string) bool {
	if len(h) != 64 {
		return false
	}
	_, err := hex.DecodeString(h)
	return err == nil
}
