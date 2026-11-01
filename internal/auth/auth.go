package auth

import (
	"cmp"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/github"

	"github.com/ertugruldasgin/latex-editor/internal/store"
)

const (
	sessionCookie = "session"
	stateCookie   = "oauth_state"
	sessionTTL    = 30 * 24 * time.Hour
)

type Config struct {
	ClientID     string
	ClientSecret string
	BaseURL      string
}

type Auth struct {
	store  *store.Store
	oauth  *oauth2.Config
	secure bool
}

func New(st *store.Store, cfg Config) *Auth {
	return &Auth{
		store: st,
		oauth: &oauth2.Config{
			ClientID:     cfg.ClientID,
			ClientSecret: cfg.ClientSecret,
			Endpoint:     github.Endpoint,
			RedirectURL:  cfg.BaseURL + "/auth/callback",
		},
		secure: strings.HasPrefix(cfg.BaseURL, "https://"),
	}
}

func (a *Auth) Login(w http.ResponseWriter, r *http.Request) {
	state := rand.Text()
	http.SetCookie(w, &http.Cookie{
		Name: stateCookie, Value: state, Path: "/auth", MaxAge: 600,
		HttpOnly: true, Secure: a.secure, SameSite: http.SameSiteLaxMode,
	})
	http.Redirect(w, r, a.oauth.AuthCodeURL(state), http.StatusFound)
}

func (a *Auth) Callback(w http.ResponseWriter, r *http.Request) {
	c, err := r.Cookie(stateCookie)
	if err != nil || c.Value == "" || c.Value != r.URL.Query().Get("state") {
		http.Error(w, "invalid login state, please try again", http.StatusBadRequest)
		return
	}
	http.SetCookie(w, &http.Cookie{Name: stateCookie, Path: "/auth", MaxAge: -1})

	tok, err := a.oauth.Exchange(r.Context(), r.URL.Query().Get("code"))
	if err != nil {
		http.Error(w, "github login failed", http.StatusBadGateway)
		return
	}
	gh, err := fetchGitHubUser(r.Context(), a.oauth.Client(r.Context(), tok))
	if err != nil {
		log.Printf("auth: %v", err)
		http.Error(w, "could not read github profile", http.StatusBadGateway)
		return
	}

	user, err := a.store.UpsertUser(r.Context(), store.User{
		GitHubID:  gh.ID,
		Login:     gh.Login,
		Name:      cmp.Or(gh.Name, gh.Login),
		AvatarURL: gh.AvatarURL,
	})
	if err != nil {
		log.Printf("auth: save user: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	token := rand.Text()
	if err := a.store.CreateSession(r.Context(), hashToken(token), user.ID, time.Now().Add(sessionTTL)); err != nil {
		log.Printf("auth: create session: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name: sessionCookie, Value: token, Path: "/", MaxAge: int(sessionTTL.Seconds()),
		HttpOnly: true, Secure: a.secure, SameSite: http.SameSiteLaxMode,
	})
	http.Redirect(w, r, "/", http.StatusFound)
}

func (a *Auth) Logout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(sessionCookie); err == nil {
		if err := a.store.DeleteSession(r.Context(), hashToken(c.Value)); err != nil {
			log.Printf("auth: delete session: %v", err)
		}
	}
	http.SetCookie(w, &http.Cookie{Name: sessionCookie, Path: "/", MaxAge: -1})
	w.WriteHeader(http.StatusNoContent)
}

func (a *Auth) Me(w http.ResponseWriter, r *http.Request) {
	user, _ := UserFrom(r.Context())
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

type ctxKey struct{}

func (a *Auth) Require(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c, err := r.Cookie(sessionCookie)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "not logged in")
			return
		}
		user, err := a.store.SessionUser(r.Context(), hashToken(c.Value))
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusUnauthorized, "session expired")
			return
		}
		if err != nil {
			log.Printf("auth: load session: %v", err)
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, user)))
	})
}

func UserFrom(ctx context.Context) (store.User, bool) {
	u, ok := ctx.Value(ctxKey{}).(store.User)
	return u, ok
}

type githubUser struct {
	ID        int64  `json:"id"`
	Login     string `json:"login"`
	Name      string `json:"name"`
	AvatarURL string `json:"avatar_url"`
}

func fetchGitHubUser(ctx context.Context, client *http.Client) (githubUser, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.github.com/user", nil)
	if err != nil {
		return githubUser{}, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")

	res, err := client.Do(req)
	if err != nil {
		return githubUser{}, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return githubUser{}, fmt.Errorf("github /user: %s", res.Status)
	}

	var u githubUser
	if err := json.NewDecoder(res.Body).Decode(&u); err != nil {
		return githubUser{}, err
	}
	return u, nil
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func writeError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
