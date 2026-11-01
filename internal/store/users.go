package store

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

var ErrNotFound = errors.New("not found")

type User struct {
	ID        int64  `json:"id"`
	GitHubID  int64  `json:"-"`
	Login     string `json:"login"`
	Name      string `json:"name"`
	AvatarURL string `json:"avatarUrl"`
}

func (s *Store) UpsertUser(ctx context.Context, u User) (User, error) {
	err := s.db.QueryRowContext(ctx, `
		INSERT INTO users (github_id, login, name, avatar_url, created_at)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT (github_id) DO UPDATE SET
			login = excluded.login, name = excluded.name, avatar_url = excluded.avatar_url
		RETURNING id`,
		u.GitHubID, u.Login, u.Name, u.AvatarURL, time.Now().Unix(),
	).Scan(&u.ID)
	return u, err
}

func (s *Store) CreateSession(ctx context.Context, tokenHash string, userID int64, expires time.Time) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)`,
		tokenHash, userID, expires.Unix())
	return err
}

func (s *Store) SessionUser(ctx context.Context, tokenHash string) (User, error) {
	var u User
	err := s.db.QueryRowContext(ctx, `
		SELECT u.id, u.github_id, u.login, u.name, u.avatar_url
		FROM sessions s JOIN users u ON u.id = s.user_id
		WHERE s.token_hash = ? AND s.expires_at > ?`,
		tokenHash, time.Now().Unix(),
	).Scan(&u.ID, &u.GitHubID, &u.Login, &u.Name, &u.AvatarURL)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, ErrNotFound
	}
	return u, err
}

func (s *Store) DeleteSession(ctx context.Context, tokenHash string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM sessions WHERE token_hash = ?`, tokenHash)
	return err
}
