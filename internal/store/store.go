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
`

type Store struct {
	db *sql.DB
}

func Open(path string) (*Store, error) {
	db, err := sql.Open("sqlite", path+"?_pragma=journal_mode(WAL)")
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

func (s *Store) Load(ctx context.Context, project string) ([][]byte, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT data FROM doc_updates WHERE project = ? ORDER BY id`, project)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var updates [][]byte
	for rows.Next() {
		var data []byte
		if err := rows.Scan(&data); err != nil {
			return nil, err
		}
		updates = append(updates, data)
	}
	return updates, rows.Err()
}
