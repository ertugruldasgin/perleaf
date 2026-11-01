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
