package app

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

func TestScheduledDrawAndFamilyRestrictions(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set TEST_DATABASE_URL to run PostgreSQL integration test")
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
	ids := make([]int64, 4)
	for i := range ids {
		err = db.QueryRow(ctx, "insert into users(username,name,password) values($1,$2,'unused') returning id", token(), "test").Scan(&ids[i])
		if err != nil {
			t.Fatal(err)
		}
		defer db.Exec(ctx, "delete from users where id=$1", ids[i])
	}
	var group int64
	err = db.QueryRow(ctx, "insert into groups(name,owner_id,invite,scheduled_at) values('test',$1,$2,now()-interval '1 minute') returning id", ids[0], token()).Scan(&group)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Exec(ctx, "delete from groups where id=$1", group)
	for i, id := range ids {
		family := ""
		if i < 2 {
			family = "casa"
		}
		if _, err = db.Exec(ctx, "insert into members(group_id,user_id,family) values($1,$2,$3)", group, id, family); err != nil {
			t.Fatal(err)
		}
	}
	processScheduled()
	processScheduled()
	var status string
	var count, bad int
	db.QueryRow(ctx, "select status from groups where id=$1", group).Scan(&status)
	db.QueryRow(ctx, "select count(*),count(*) filter (where r.giver=r.recipient or (a.family<>'' and a.family=b.family)) from results r join members a on a.group_id=r.group_id and a.user_id=r.giver join members b on b.group_id=r.group_id and b.user_id=r.recipient where r.group_id=$1", group).Scan(&count, &bad)
	if status != "drawn" || count != 4 || bad != 0 {
		t.Fatalf("status=%s results=%d invalid=%d", status, count, bad)
	}
	if _, err = db.Exec(ctx, "delete from results where group_id=$1", group); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, "update members set family='same' where group_id=$1", group); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, "update groups set status='open',scheduled_at=now()-interval '1 minute' where id=$1", group); err != nil {
		t.Fatal(err)
	}
	processScheduled()
	db.QueryRow(ctx, "select status from groups where id=$1", group).Scan(&status)
	db.QueryRow(ctx, "select count(*) from results where group_id=$1", group).Scan(&count)
	if status != "needs_adjustment" || count != 0 {
		t.Fatalf("impossible draw: status=%s results=%d", status, count)
	}
	if _, err = db.Exec(ctx, "update members set family='' where group_id=$1", group); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, "update groups set status='open',scheduled_at=null where id=$1", group); err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	outcomes := make(chan error, 8)
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); outcomes <- runDraw(group, ids[0], false) }()
	}
	wg.Wait()
	close(outcomes)
	successes := 0
	for e := range outcomes {
		if e == nil {
			successes++
		}
	}
	if successes != 1 {
		t.Fatalf("concurrent draws: expected one success, got %d", successes)
	}
	db.QueryRow(ctx, "select count(*) from results where group_id=$1", group).Scan(&count)
	if count != 4 {
		t.Fatalf("concurrent draws produced %d results", count)
	}
}

func TestRecoveryCodeIsSingleUseAndRevokesSessions(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set TEST_DATABASE_URL")
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
	password, err := bcrypt.GenerateFromPassword([]byte("old-password"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatal(err)
	}
	username := token()
	var user int64
	err = db.QueryRow(ctx, "insert into users(username,name,password) values($1,'test',$2) returning id", username, string(password)).Scan(&user)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Exec(ctx, "delete from users where id=$1", user)
	sessionToken := token()
	if _, err = db.Exec(ctx, "insert into sessions(token,user_id,expires_at) values($1,$2,now()+interval '1 day')", hash(sessionToken), user); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest("POST", "/api/recovery-codes", strings.NewReader(`{"password":"old-password"}`))
	req.AddCookie(&http.Cookie{Name: "session", Value: sessionToken})
	rec := httptest.NewRecorder()
	recoveryCodes(rec, req)
	if rec.Code != 200 {
		t.Fatalf("generate: %d %s", rec.Code, rec.Body.String())
	}
	var result struct {
		Codes []string `json:"codes"`
	}
	if err = json.Unmarshal(rec.Body.Bytes(), &result); err != nil || len(result.Codes) != 8 {
		t.Fatalf("invalid codes: %v", err)
	}
	payload, _ := json.Marshal(map[string]string{"username": username, "code": result.Codes[0], "password": "new-password"})
	for i := 0; i < 2; i++ {
		rec = httptest.NewRecorder()
		recoverAccount(rec, httptest.NewRequest("POST", "/api/recovery", bytes.NewReader(payload)))
		want := 200
		if i == 1 {
			want = 400
		}
		if rec.Code != want {
			t.Fatalf("attempt %d: %d %s", i, rec.Code, rec.Body.String())
		}
	}
	var sessions int
	db.QueryRow(ctx, "select count(*) from sessions where user_id=$1", user).Scan(&sessions)
	if sessions != 0 {
		t.Fatalf("sessions remaining: %d", sessions)
	}
}
