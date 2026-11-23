package app

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestWebsocketAuthorizationAndPrivateEvents(t *testing.T) {
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
	ids := make([]int64, 4)
	tokens := make([]string, 4)
	for i := range ids {
		err = db.QueryRow(ctx, "insert into users(username,name,password) values($1,'test','unused') returning id", token()).Scan(&ids[i])
		if err != nil {
			t.Fatal(err)
		}
		defer db.Exec(ctx, "delete from users where id=$1", ids[i])
		tokens[i] = token()
		if _, err = db.Exec(ctx, "insert into sessions(token,user_id,expires_at) values($1,$2,now()+interval '1 day')", hash(tokens[i]), ids[i]); err != nil {
			t.Fatal(err)
		}
	}
	var g int64
	err = db.QueryRow(ctx, "insert into groups(name,owner_id,invite,status) values('websocket test',$1,$2,'drawn') returning id", ids[0], token()).Scan(&g)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Exec(ctx, "delete from groups where id=$1", g)
	for _, id := range ids[:3] {
		if _, err = db.Exec(ctx, "insert into members(group_id,user_id) values($1,$2)", g, id); err != nil {
			t.Fatal(err)
		}
	}
	for i := 0; i < 3; i++ {
		if _, err = db.Exec(ctx, "insert into results(group_id,giver,recipient) values($1,$2,$3)", g, ids[i], ids[(i+1)%3]); err != nil {
			t.Fatal(err)
		}
	}
	listenerCtx, cancel := context.WithCancel(context.Background())
	ready := make(chan struct{})
	listenerDone := make(chan struct{})
	go func() { defer close(listenerDone); listenUpdates(listenerCtx, ready) }()
	select {
	case <-ready:
	case <-time.After(5 * time.Second):
		cancel()
		t.Fatal("listener did not start")
	}
	defer func() { cancel(); <-listenerDone }()
	server := httptest.NewServer(newHandler())
	defer server.Close()
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + fmt.Sprintf("/api/groups/%d/events", g)
	dial := func(i int, origin string) (*websocket.Conn, *http.Response, error) {
		h := http.Header{}
		h.Set("Origin", origin)
		h.Set("Cookie", "session="+tokens[i])
		return websocket.DefaultDialer.Dial(wsURL, h)
	}
	if conn, resp, e := dial(3, server.URL); e == nil {
		conn.Close()
		t.Fatal("non-member connected")
	} else if resp == nil || resp.StatusCode != 403 {
		t.Fatalf("non-member status: %v", resp)
	}
	if conn, resp, e := dial(0, "https://evil.example"); e == nil {
		conn.Close()
		t.Fatal("cross-origin socket connected")
	} else if resp == nil || resp.StatusCode != 403 {
		t.Fatalf("cross-origin status: %v", resp)
	}
	conns := make([]*websocket.Conn, 3)
	for i := range conns {
		conns[i], _, err = dial(i, server.URL)
		if err != nil {
			t.Fatal(err)
		}
		defer conns[i].Close()
	}
	// A single account cannot exhaust one group with unlimited sockets.
	var extra []*websocket.Conn
	for i := 0; i < 7; i++ {
		conn, _, err := dial(0, server.URL)
		if err != nil {
			t.Fatalf("additional connection %d: %v", i, err)
		}
		extra = append(extra, conn)
	}
	if conn, resp, err := dial(0, server.URL); err == nil {
		conn.Close()
		t.Fatal("connection limit was not enforced")
	} else if resp == nil || resp.StatusCode != http.StatusTooManyRequests {
		t.Fatalf("connection limit status: %v", resp)
	}
	for _, conn := range extra {
		conn.Close()
	}
	accountDial := func(i int, origin string) (*websocket.Conn, *http.Response, error) {
		h := http.Header{}
		h.Set("Origin", origin)
		h.Set("Cookie", "session="+tokens[i])
		return websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(server.URL, "http")+"/api/events", h)
	}
	if c, resp, e := accountDial(0, "https://evil.example"); e == nil {
		c.Close()
		t.Fatal("cross-origin account socket connected")
	} else if resp == nil || resp.StatusCode != 403 {
		t.Fatalf("account origin status: %v", resp)
	}
	account, _, err := accountDial(0, server.URL)
	if err != nil {
		t.Fatal(err)
	}
	defer account.Close()
	outsider, _, err := accountDial(3, server.URL)
	if err != nil {
		t.Fatal(err)
	}
	defer outsider.Close()
	notifyUpdate(updateEvent{Group: g, Kind: "group"})
	for i := range conns {
		conns[i].SetReadDeadline(time.Now().Add(3 * time.Second))
		var update map[string]any
		if err = conns[i].ReadJSON(&update); err != nil {
			t.Fatalf("group event %d: %v", i, err)
		}
		if len(update) != 1 || update["type"] != "group" {
			t.Fatalf("unexpected group event: %v", update)
		}
	}
	account.SetReadDeadline(time.Now().Add(3 * time.Second))
	var accountUpdate map[string]any
	if err = account.ReadJSON(&accountUpdate); err != nil {
		t.Fatalf("account event: %v", err)
	}
	if len(accountUpdate) != 2 || accountUpdate["type"] != "group" || accountUpdate["group"] != float64(g) {
		t.Fatalf("unexpected account event: %v", accountUpdate)
	}
	outsider.SetReadDeadline(time.Now().Add(300 * time.Millisecond))
	if err = outsider.ReadJSON(&accountUpdate); err == nil {
		t.Fatal("account event leaked to non-member")
	}
	body, _ := json.Marshal(map[string]string{"content": "mensagem privada"})
	req, _ := http.NewRequest("POST", server.URL+fmt.Sprintf("/api/groups/%d/chat/outgoing", g), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", server.URL)
	req.AddCookie(&http.Cookie{Name: "session", Value: tokens[0]})
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Fatalf("chat response: %d", resp.StatusCode)
	}
	for _, i := range []int{0, 1} {
		conns[i].SetReadDeadline(time.Now().Add(3 * time.Second))
		var event map[string]any
		if err = conns[i].ReadJSON(&event); err != nil {
			t.Fatalf("recipient %d: %v", i, err)
		}
		if len(event) != 1 || event["type"] != "chat" {
			t.Fatalf("event revealed data or wrong kind: %v", event)
		}
	}
	readReq, _ := http.NewRequest("GET", server.URL+fmt.Sprintf("/api/groups/%d/chat/incoming", g), nil)
	readReq.AddCookie(&http.Cookie{Name: "session", Value: tokens[1]})
	readResp, err := http.DefaultClient.Do(readReq)
	if err != nil {
		t.Fatal(err)
	}
	readResp.Body.Close()
	if readResp.StatusCode != 200 {
		t.Fatalf("read response: %d", readResp.StatusCode)
	}
	conns[1].SetReadDeadline(time.Now().Add(3 * time.Second))
	var readEvent map[string]any
	if err = conns[1].ReadJSON(&readEvent); err != nil {
		t.Fatal(err)
	}
	if len(readEvent) != 1 || readEvent["type"] != "read" {
		t.Fatalf("unexpected read event: %v", readEvent)
	}
	conns[2].SetReadDeadline(time.Now().Add(300 * time.Millisecond))
	var event any
	if err = conns[2].ReadJSON(&event); err == nil {
		t.Fatalf("unrelated participant received chat event: %v", event)
	}
}
