package store

import (
	"context"
	"database/sql"

	_ "modernc.org/sqlite"
)

const schema = `
CREATE TABLE IF NOT EXISTS doc_updates (
	id      INTEGER PRIMARY KEY AUTOINCREMENT,
	project TEXT NOT NULL,
	data    BLOB NOT NULL
);
CREATE INDEX IF NOT EXISTS doc_updates_project ON doc_updates (project, id);
CREATE TABLE IF NOT EXISTS users (
	id         INTEGER PRIMARY KEY AUTOINCREMENT,
	github_id  INTEGER NOT NULL UNIQUE,
	login      TEXT NOT NULL,
	name       TEXT NOT NULL,
	avatar_url TEXT NOT NULL,
	created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
	token_hash TEXT PRIMARY KEY,
	user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS projects (
	id         TEXT PRIMARY KEY,
	name       TEXT NOT NULL,
	created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS project_members (
	project_id TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
	user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	role       TEXT NOT NULL CHECK (role IN ('owner', 'editor')),
	PRIMARY KEY (project_id, user_id)
);
`

type Store struct {
	db *sql.DB
}

func Open(path string) (*Store, error) {
	db, err := sql.Open("sqlite", path+"?_pragma=journal_mode(WAL)&_pragma=foreign_keys(1)")
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(schema); err != nil {
		db.Close()
		return nil, err
	}
	return &Store{db: db}, nil
}

func (s *Store) Close() error {
	return s.db.Close()
}

func (s *Store) Append(ctx context.Context, project string, update []byte) error {
	_, err := s.db.ExecContext(ctx, `INSERT INTO doc_updates (project, data) VALUES (?, ?)`, project, update)
	return err
}

func (s *Store) Load(ctx context.Context, project string) ([][]byte, int64, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id, data FROM doc_updates WHERE project = ? ORDER BY id`, project)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var updates [][]byte
	var lastID int64
	for rows.Next() {
		var data []byte
		if err := rows.Scan(&lastID, &data); err != nil {
			return nil, 0, err
		}
		updates = append(updates, data)
	}
	return updates, lastID, rows.Err()
}

func (s *Store) Compact(ctx context.Context, project string, upTo int64, snapshot []byte) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `DELETE FROM doc_updates WHERE project = ? AND id <= ?`, project, upTo); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO doc_updates (project, data) VALUES (?, ?)`, project, snapshot); err != nil {
		return err
	}
	return tx.Commit()
}
