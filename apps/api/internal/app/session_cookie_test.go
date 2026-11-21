package app

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

func TestSessionCookieAndLogout(t *testing.T) {
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
	t.Setenv("ENV", "production")
	username := token()[:32]
	pass, _ := bcrypt.GenerateFromPassword([]byte("test-password"), bcrypt.DefaultCost)
	var user int64
	if err = db.QueryRow(ctx, "insert into users(username,name,password) values($1,'Cookie test',$2) returning id", username, string(pass)).Scan(&user); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(ctx, "delete from users where id=$1", user)
	payload := []byte(`{"username":"` + username + `","password":"test-password"}`)
	req := httptest.NewRequest("POST", "https://example.test/api/login", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	newHandler().ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("login: %d %s", rec.Code, rec.Body.String())
	}
	cookies := rec.Result().Cookies()
	if len(cookies) != 1 {
		t.Fatalf("cookies: %v", cookies)
	}
	cookie := cookies[0]
	if cookie.Name != "session" || !cookie.HttpOnly || !cookie.Secure || cookie.SameSite != http.SameSiteLaxMode || cookie.Path != "/" || cookie.Domain != "" || cookie.MaxAge <= 0 {
		t.Fatalf("session cookie missing required attributes: %+v", cookie)
	}
	req = httptest.NewRequest("POST", "https://example.test/api/logout", bytes.NewBufferString("{}"))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(cookie)
	rec = httptest.NewRecorder()
	newHandler().ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("logout: %d", rec.Code)
	}
	cleared := rec.Result().Cookies()
	if len(cleared) != 1 || cleared[0].MaxAge >= 0 || !cleared[0].HttpOnly || !cleared[0].Secure || cleared[0].SameSite != http.SameSiteLaxMode {
		t.Fatalf("logout cookie: %+v", cleared)
	}
	req = httptest.NewRequest("GET", "https://example.test/api/me", nil)
	req.AddCookie(cookie)
	rec = httptest.NewRecorder()
	newHandler().ServeHTTP(rec, req)
	if rec.Code != 401 {
		t.Fatalf("revoked session remained valid: %d", rec.Code)
	}
}
