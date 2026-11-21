package app

import (
	"context"
	"net/http/httptest"
	"os"
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
