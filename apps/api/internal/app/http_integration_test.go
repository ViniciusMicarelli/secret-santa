package app

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

type testUser struct {
	client *http.Client
	id     int64
	name   string
}

func TestFullHTTPFlow(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("set TEST_DATABASE_URL to an isolated test database")
	}
	var err error
	db, err = pgxpool.New(context.Background(), databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(db.Close)
	if err = initDB(); err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(newHandler())
	defer server.Close()
	call := func(c *http.Client, method, path string, payload any, want int) map[string]any {
		t.Helper()
		var b io.Reader
		if payload != nil {
			raw, e := json.Marshal(payload)
			if e != nil {
				t.Fatal(e)
			}
			b = bytes.NewReader(raw)
		}
		r, e := http.NewRequest(method, server.URL+path, b)
		if e != nil {
			t.Fatal(e)
		}
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("Origin", server.URL)
		resp, e := c.Do(r)
		if e != nil {
			t.Fatal(e)
		}
		defer resp.Body.Close()
		var decoded any
		if e = json.NewDecoder(resp.Body).Decode(&decoded); e != nil {
			t.Fatal(e)
		}
		out, _ := decoded.(map[string]any)
		if out == nil {
			out = map[string]any{}
		}
		if resp.StatusCode != want {
			t.Fatalf("%s %s: got %d want %d: %v", method, path, resp.StatusCode, want, out)
		}
		return out
	}
	users := make([]testUser, 4)
	for i := range users {
		jar, e := cookiejar.New(nil)
		if e != nil {
			t.Fatal(e)
		}
		users[i].client = &http.Client{Jar: jar}
		users[i].name = fmt.Sprintf("Pessoa %d", i)
		u := call(users[i].client, "POST", "/api/register", map[string]string{"username": token()[:20], "password": "test-password", "name": users[i].name}, 200)
		users[i].id = int64(u["id"].(float64))
		id := users[i].id
		t.Cleanup(func() { db.Exec(ctx, "delete from users where id=$1", id) })
	}
	owner, second, third, outsider := users[0], users[1], users[2], users[3]
	group := call(owner.client, "POST", "/api/groups", map[string]string{"name": "Grupo de teste"}, 200)
	g := int64(group["id"].(float64))
	t.Cleanup(func() { db.Exec(ctx, "delete from groups where id=$1", g) })
	path := fmt.Sprintf("/api/groups/%d", g)
	info := call(owner.client, "GET", path, nil, 200)
	old := info["invite"].(string)
	call(owner.client, "POST", path+"/invite", map[string]any{}, 200)
	invite := call(owner.client, "GET", path, nil, 200)["invite"].(string)
	if invite == old {
		t.Fatal("invite was not rotated")
	}
	call(second.client, "POST", "/api/join/"+old, map[string]any{}, 400)
	call(second.client, "POST", "/api/join/"+invite, map[string]any{}, 200)
	call(third.client, "POST", "/api/join/"+invite, map[string]any{}, 200)
	call(outsider.client, "GET", path, nil, 403)
	call(outsider.client, "POST", "/api/join/"+invite, map[string]any{}, 200)
	call(second.client, "DELETE", fmt.Sprintf("%s/members/%d", path, outsider.id), nil, 403)
	call(owner.client, "DELETE", fmt.Sprintf("%s/members/%d", path, outsider.id), nil, 200)
	call(outsider.client, "GET", path, nil, 403)
	call(outsider.client, "POST", "/api/join/"+invite, map[string]any{}, 400)
	call(second.client, "POST", path+"/draw", map[string]any{}, 400)
	call(second.client, "POST", path+"/family", map[string]any{"userId": owner.id, "family": "casa"}, 403)
	call(owner.client, "POST", path+"/family", map[string]any{"userId": owner.id, "family": "casa"}, 200)
	call(second.client, "POST", path+"/wish", map[string]string{"title": "Teste", "link": "javascript:alert(1)"}, 400)
	call(outsider.client, "POST", path+"/wish", map[string]string{"title": "Não autorizado"}, 403)
	call(second.client, "POST", path+"/wish", map[string]string{"title": "Livro", "detail": "Ficção"}, 200)
	wish := call(second.client, "GET", path, nil, 200)["wishes"].([]any)[0].(map[string]any)
	wishID := int64(wish["id"].(float64))
	call(outsider.client, "DELETE", fmt.Sprintf("%s/wish/%d", path, wishID), nil, 403)
	call(third.client, "DELETE", fmt.Sprintf("%s/wish/%d", path, wishID), nil, 404)
	call(third.client, "PUT", fmt.Sprintf("%s/wish/%d", path, wishID), map[string]string{"title": "Alteração indevida"}, 404)
	call(second.client, "PUT", fmt.Sprintf("%s/wish/%d", path, wishID), map[string]string{"title": "Livro atualizado", "detail": "Fantasia"}, 200)
	updated := call(second.client, "GET", path, nil, 200)["wishes"].([]any)[0].(map[string]any)
	if updated["title"] != "Livro atualizado" || updated["detail"] != "Fantasia" {
		t.Fatalf("wish was not updated: %v", updated)
	}
	call(third.client, "POST", fmt.Sprintf("%s/wish/%d/favorite", path, wishID), map[string]any{}, 404)
	call(second.client, "POST", fmt.Sprintf("%s/wish/%d/favorite", path, wishID), map[string]any{}, 200)
	call(owner.client, "POST", path+"/draw", map[string]any{}, 200)
	call(owner.client, "POST", path+"/draw", map[string]any{}, 400)
	call(owner.client, "POST", path+"/invite", map[string]any{}, 400)
	for _, u := range users[:3] {
		v := call(u.client, "GET", path, nil, 200)
		if int64(v["targetId"].(float64)) == u.id {
			t.Fatal("self draw")
		}
		if _, ok := v["results"]; ok {
			t.Fatal("group disclosed all results")
		}
	}
	call(owner.client, "POST", path+"/chat/outgoing", map[string]string{"content": "Alguma dica?"}, 200)
	info = call(owner.client, "GET", path, nil, 200)
	target := int64(info["targetId"].(float64))
	var recipient testUser
	for _, u := range users {
		if u.id == target {
			recipient = u
		}
	}
	checkDashboardUnread := func(want float64) {
		t.Helper()
		response, e := recipient.client.Get(server.URL + "/api/groups")
		if e != nil {
			t.Fatal(e)
		}
		defer response.Body.Close()
		var groups []map[string]any
		if e = json.NewDecoder(response.Body).Decode(&groups); e != nil {
			t.Fatal(e)
		}
		for _, item := range groups {
			if int64(item["id"].(float64)) == g {
				if item["unread"].(float64) != want {
					t.Fatalf("dashboard unread = %v, want %v", item["unread"], want)
				}
				return
			}
		}
		t.Fatal("group missing from dashboard")
	}
	checkDashboardUnread(1)
	info = call(recipient.client, "GET", path, nil, 200)
	unread := info["unread"].(map[string]any)
	if unread["incoming"].(float64) != 1 {
		t.Fatalf("missing unread message: %v", unread)
	}
	resp, e := recipient.client.Get(server.URL + path + "/chat/incoming")
	if e != nil {
		t.Fatal(e)
	}
	var messages []map[string]any
	if e = json.NewDecoder(resp.Body).Decode(&messages); e != nil {
		t.Fatal(e)
	}
	resp.Body.Close()
	if len(messages) != 1 || messages[0]["mine"] != false || messages[0]["content"] != "Alguma dica?" {
		t.Fatalf("unexpected messages: %v", messages)
	}
	if _, ok := messages[0]["sender"]; ok {
		t.Fatal("sender identity disclosed")
	}
	info = call(recipient.client, "GET", path, nil, 200)
	if info["unread"].(map[string]any)["incoming"].(float64) != 0 {
		t.Fatal("message still unread")
	}
	checkDashboardUnread(0)
	call(recipient.client, "POST", path+"/chat/incoming/report", map[string]string{"reason": "Mensagem inadequada"}, 200)
	badOrigin, _ := http.NewRequest("POST", server.URL+"/api/logout", bytes.NewBufferString("{}"))
	badOrigin.Header.Set("Content-Type", "application/json")
	badOrigin.Header.Set("Origin", "https://evil.example")
	badResp, e := owner.client.Do(badOrigin)
	if e != nil {
		t.Fatal(e)
	}
	badResp.Body.Close()
	if badResp.StatusCode != 403 {
		t.Fatalf("cross-origin request: %d", badResp.StatusCode)
	}
}
