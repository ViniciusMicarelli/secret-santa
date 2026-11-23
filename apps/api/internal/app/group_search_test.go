package app

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestGroupSearchFiltersPaginationAndIsolation(t *testing.T) {
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
	ids := make([]int64, 3)
	for i, name := range []string{"Organizador", "Bárbara", "Outra pessoa"} {
		if err = db.QueryRow(ctx, "insert into users(username,name,password) values($1,$2,'unused') returning id", token(), name).Scan(&ids[i]); err != nil {
			t.Fatal(err)
		}
		id := ids[i]
		defer db.Exec(ctx, "delete from users where id=$1", id)
	}
	sessionToken := token()
	if _, err = db.Exec(ctx, "insert into sessions(token,user_id,expires_at) values($1,$2,now()+interval '1 day')", hash(sessionToken), ids[0]); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 16; i++ {
		owner := ids[0]
		name := fmt.Sprintf("Festa %02d", i)
		description := "livros e biblioteca"
		date := "2026-12-15"
		state := "open"
		if i == 15 {
			owner = ids[2]
			name = "segredo inacessivel"
		}
		if i == 1 {
			state = "drawn"
		}
		var group int64
		err = db.QueryRow(ctx, "insert into groups(name,description,event_date,owner_id,invite,status,scheduled_at) values($1,$2,$3,$4,$5,$6,case when $7 then now()+interval '1 day' else null end) returning id", name, description, date, owner, token(), state, i == 2).Scan(&group)
		if err != nil {
			t.Fatal(err)
		}
		defer db.Exec(ctx, "delete from groups where id=$1", group)
		if _, err = db.Exec(ctx, "insert into members(group_id,user_id) values($1,$2)", group, owner); err != nil {
			t.Fatal(err)
		}
		if i == 0 {
			if _, err = db.Exec(ctx, "insert into members(group_id,user_id) values($1,$2)", group, ids[1]); err != nil {
				t.Fatal(err)
			}
		}
	}
	handler := newHandler()
	call := func(params string, want int) map[string]any {
		t.Helper()
		req := httptest.NewRequest("GET", "http://example.test/api/groups/search"+params, nil)
		req.AddCookie(&http.Cookie{Name: "session", Value: sessionToken})
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != want {
			t.Fatalf("%s: got %d, body %s", params, rec.Code, rec.Body.String())
		}
		var payload map[string]any
		if json.Unmarshal(rec.Body.Bytes(), &payload) != nil {
			t.Fatal("invalid json")
		}
		return payload
	}
	first := call("?page=1", 200)
	if first["total"] != float64(15) || len(first["items"].([]any)) != 12 || first["totalPages"] != float64(2) {
		t.Fatalf("first page: %v", first)
	}
	second := call("?page=2", 200)
	if len(second["items"].([]any)) != 3 {
		t.Fatal("second page size")
	}
	for _, tc := range []struct {
		query string
		total float64
	}{{"?q=bibliotecas", 15}, {"?q=segredo+inacessivel", 0}, {"?participant=" + url.QueryEscape("Bárbara"), 1}, {"?status=scheduled", 1}, {"?status=open", 13}, {"?status=drawn", 1}, {"?from=2026-12-16", 0}, {"?from=2026-12-15&to=2026-12-15", 15}} {
		got := call(tc.query, 200)
		if got["total"] != tc.total {
			t.Errorf("%s: got %v, want %v", tc.query, got["total"], tc.total)
		}
	}
	call("?page=0", 400)
	call("?sort=invalid", 400)
	call("?from=2026-12-20&to=2026-12-10", 400)
	unauth := httptest.NewRecorder()
	handler.ServeHTTP(unauth, httptest.NewRequest("GET", "http://example.test/api/groups/search", nil))
	if unauth.Code != 401 {
		t.Fatalf("unauthenticated: %d", unauth.Code)
	}
}
