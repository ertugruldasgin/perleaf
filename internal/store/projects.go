package store

import (
	"context"
	"crypto/rand"
	"database/sql"
	"errors"
	"time"
)

const (
	RoleOwner  = "owner"
	RoleEditor = "editor"
)

type Project struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Role      string `json:"role"`
	CreatedAt int64  `json:"createdAt"`
}

type Member struct {
	User
	Role string `json:"role"`
}

func (s *Store) CreateProject(ctx context.Context, name string, ownerID int64) (Project, error) {
	p := Project{ID: rand.Text(), Name: name, Role: RoleOwner, CreatedAt: time.Now().Unix()}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Project{}, err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx,
		`INSERT INTO projects (id, name, created_at) VALUES (?, ?, ?)`,
		p.ID, p.Name, p.CreatedAt); err != nil {
		return Project{}, err
	}
	if _, err := tx.ExecContext(ctx,
		`INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)`,
		p.ID, ownerID, p.Role); err != nil {
		return Project{}, err
	}
	return p, tx.Commit()
}

func (s *Store) RenameProject(ctx context.Context, id, name string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE projects SET name = ? WHERE id = ?`, name, id)
	return err
}

func (s *Store) DeleteProject(ctx context.Context, id string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `DELETE FROM doc_updates WHERE project = ?`, id); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM projects WHERE id = ?`, id); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) ListProjects(ctx context.Context, userID int64) ([]Project, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT p.id, p.name, m.role, p.created_at
		FROM projects p JOIN project_members m ON m.project_id = p.id
		WHERE m.user_id = ?
		ORDER BY p.created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	projects := []Project{}
	for rows.Next() {
		var p Project
		if err := rows.Scan(&p.ID, &p.Name, &p.Role, &p.CreatedAt); err != nil {
			return nil, err
		}
		projects = append(projects, p)
	}
	return projects, rows.Err()
}

func (s *Store) ProjectForMember(ctx context.Context, projectID string, userID int64) (Project, error) {
	var p Project
	err := s.db.QueryRowContext(ctx, `
		SELECT p.id, p.name, m.role, p.created_at
		FROM projects p JOIN project_members m ON m.project_id = p.id
		WHERE p.id = ? AND m.user_id = ?`, projectID, userID,
	).Scan(&p.ID, &p.Name, &p.Role, &p.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return Project{}, ErrNotFound
	}
	return p, err
}

func (s *Store) ListMembers(ctx context.Context, projectID string) ([]Member, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT u.id, u.github_id, u.login, u.name, u.avatar_url, m.role
		FROM project_members m JOIN users u ON u.id = m.user_id
		WHERE m.project_id = ?
		ORDER BY m.role DESC, u.login`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	members := []Member{}
	for rows.Next() {
		var m Member
		if err := rows.Scan(&m.ID, &m.GitHubID, &m.Login, &m.Name, &m.AvatarURL, &m.Role); err != nil {
			return nil, err
		}
		members = append(members, m)
	}
	return members, rows.Err()
}

func (s *Store) RemoveMember(ctx context.Context, projectID string, userID int64) error {
	res, err := s.db.ExecContext(ctx,
		`DELETE FROM project_members WHERE project_id = ? AND user_id = ? AND role != ?`,
		projectID, userID, RoleOwner)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) CreateInvite(ctx context.Context, tokenHash, projectID string, createdBy int64, expires time.Time) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO invites (token_hash, project_id, created_by, expires_at) VALUES (?, ?, ?, ?)`,
		tokenHash, projectID, createdBy, expires.Unix())
	return err
}

func (s *Store) AcceptInvite(ctx context.Context, tokenHash string, userID int64) (string, error) {
	var projectID string
	err := s.db.QueryRowContext(ctx,
		`SELECT project_id FROM invites WHERE token_hash = ? AND expires_at > ?`,
		tokenHash, time.Now().Unix(),
	).Scan(&projectID)
	if errors.Is(err, sql.ErrNoRows) {
		return "", ErrNotFound
	}
	if err != nil {
		return "", err
	}

	_, err = s.db.ExecContext(ctx,
		`INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?) ON CONFLICT DO NOTHING`,
		projectID, userID, RoleEditor)
	return projectID, err
}
