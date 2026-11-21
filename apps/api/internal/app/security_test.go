package app

import (
	"context"
	"golang.org/x/crypto/bcrypt"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestAuthenticationRateLimitAndOrigin(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set TEST_DATABASE_URL to an isolated test database")
	}
	var err error
	db, err = pgxpool.New(context.Background(), url)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err = initDB(); err != nil {
		t.Fatal(err)
	}
	t.Setenv("TRUST_PROXY", "")
	const ip = "198.51.100.199"
	db.Exec(ctx, "delete from rate_limits where key=$1", "auth:"+ip)
	defer db.Exec(ctx, "delete from rate_limits where key=$1", "auth:"+ip)
	handler := newHandler()
	for i := 0; i < 31; i++ {
		req := httptest.NewRequest("POST", "http://example.test/api/login", strings.NewReader("{}"))
		req.RemoteAddr = ip + ":1234"
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		want := 400
		if i == 30 {
			want = 429
		}
		if rec.Code != want {
			t.Fatalf("attempt %d: got %d want %d", i+1, rec.Code, want)
		}
		if rec.Header().Get("Cache-Control") != "no-store" {
			t.Fatal("API response is cacheable")
		}
	}
	req := httptest.NewRequest("POST", "https://example.test/api/login", strings.NewReader("{}"))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://evil.example")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != 403 {
		t.Fatalf("cross-origin request: %d", rec.Code)
	}
}

func TestRecoveryCodePasswordAttemptsAreLimitedPerAccount(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("set TEST_DATABASE_URL to an isolated test database")
	}
	var err error
	db, err = pgxpool.New(context.Background(), databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err = initDB(); err != nil {
		t.Fatal(err)
	}
	password, err := bcrypt.GenerateFromPassword([]byte("senha-correta"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatal(err)
	}
	var userID int64
	if err = db.QueryRow(ctx, "insert into users(username,name,password) values($1,'test',$2) returning id", token(), string(password)).Scan(&userID); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(ctx, "delete from users where id=$1", userID)
	key := "recovery-codes:" + strconv.FormatInt(userID, 10)
	defer db.Exec(ctx, "delete from rate_limits where key=$1", key)
	sessionToken := token()
	if _, err = db.Exec(ctx, "insert into sessions(token,user_id,expires_at) values($1,$2,now()+interval '1 day')", hash(sessionToken), userID); err != nil {
		t.Fatal(err)
	}
	handler := newHandler()
	for i := 0; i < 11; i++ {
		req := httptest.NewRequest("POST", "http://example.test/api/recovery-codes", strings.NewReader(`{"password":"senha-errada"}`))
		req.Header.Set("Content-Type", "application/json")
		req.AddCookie(&http.Cookie{Name: "session", Value: sessionToken})
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		want := 401
		if i == 10 {
			want = 429
		}
		if rec.Code != want {
			t.Fatalf("attempt %d: got %d want %d", i+1, rec.Code, want)
		}
	}
}

func TestLogoutAllInvalidatesOnlyOwnersSessions(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("set TEST_DATABASE_URL to an isolated test database")
	}
	var err error
	db, err = pgxpool.New(context.Background(), databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err = initDB(); err != nil {
		t.Fatal(err)
	}
	password, err := bcrypt.GenerateFromPassword([]byte("senha-correta"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatal(err)
	}
	var users [2]int64
	var tokens [3]string
	for i := range users {
		if err = db.QueryRow(ctx, "insert into users(username,name,password) values($1,'test',$2) returning id", token(), string(password)).Scan(&users[i]); err != nil {
			t.Fatal(err)
		}
		defer db.Exec(ctx, "delete from users where id=$1", users[i])
	}
	defer db.Exec(ctx, "delete from rate_limits where key=$1", "logout-all:"+strconv.FormatInt(users[0], 10))
	for i := range tokens {
		tokens[i] = token()
		owner := users[0]
		if i == 2 {
			owner = users[1]
		}
		if _, err = db.Exec(ctx, "insert into sessions(token,user_id,expires_at) values($1,$2,now()+interval '1 day')", hash(tokens[i]), owner); err != nil {
			t.Fatal(err)
		}
	}
	handler := newHandler()
	call := func(path, method, session, body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, "http://example.test"+path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.AddCookie(&http.Cookie{Name: "session", Value: session})
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		return rec
	}
	if r := call("/api/logout-all", "POST", tokens[0], `{"password":"incorreta"}`); r.Code != 401 {
		t.Fatalf("incorrect password: %d", r.Code)
	}
	if r := call("/api/me", "GET", tokens[1], ""); r.Code != 200 {
		t.Fatalf("other session revoked by wrong password: %d", r.Code)
	}
	if r := call("/api/logout-all", "POST", tokens[0], `{"password":"senha-correta"}`); r.Code != 200 {
		t.Fatalf("logout all: %d", r.Code)
	}
	for _, session := range tokens[:2] {
		if r := call("/api/me", "GET", session, ""); r.Code != 401 {
			t.Fatalf("old session remained: %d", r.Code)
		}
	}
	if r := call("/api/me", "GET", tokens[2], ""); r.Code != 200 {
		t.Fatalf("other user's session affected: %d", r.Code)
	}
}
