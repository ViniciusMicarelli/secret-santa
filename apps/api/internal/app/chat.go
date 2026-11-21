package app

import (
	"net/http"
	"strings"
	"time"
)

func conversationGiver(g, u int64, kind string) int64 {
	var giver int64
	if kind == "outgoing" {
		db.QueryRow(ctx, "select giver from results where group_id=$1 and giver=$2", g, u).Scan(&giver)
	} else if kind == "incoming" {
		db.QueryRow(ctx, "select giver from results where group_id=$1 and recipient=$2", g, u).Scan(&giver)
	}
	return giver
}

func unreadCounts(g, u int64) map[string]int {
	out := map[string]int{"incoming": 0, "outgoing": 0}
	for _, kind := range []string{"incoming", "outgoing"} {
		giver := conversationGiver(g, u, kind)
		if giver != 0 {
			var n int
			db.QueryRow(ctx, "select count(*) from messages m where group_id=$1 and giver=$2 and sender<>$3 and id>coalesce((select last_read_id from chat_reads where group_id=$1 and giver=$2 and user_id=$3),0)", g, giver, u).Scan(&n)
			out[kind] = n
		}
	}
	return out
}

func reportChat(w http.ResponseWriter, r *http.Request) {
	u := require(w, r)
	if u == 0 {
		return
	}
	g := gid(r)
	giver := conversationGiver(g, u, r.PathValue("kind"))
	var p struct{ Reason string }
	if giver == 0 {
		fail(w, 403, "Conversa indisponível.")
		return
	}
	if body(r, &p) != nil || len(strings.TrimSpace(p.Reason)) < 5 || len(p.Reason) > 500 {
		fail(w, 400, "Descreva o problema em 5 a 500 caracteres.")
		return
	}
	if _, e := db.Exec(ctx, "insert into chat_reports(group_id,giver,reporter,reason) values($1,$2,$3,$4)", g, giver, u, strings.TrimSpace(p.Reason)); e != nil {
		fail(w, 500, "Erro ao registrar denúncia.")
		return
	}
	respond(w, map[string]bool{"ok": true})
}

func chat(w http.ResponseWriter, r *http.Request) {
	u := require(w, r)
	if u == 0 {
		return
	}
	g := gid(r)
	var giver int64
	kind := r.PathValue("kind")
	if kind == "outgoing" {
		db.QueryRow(ctx, "select giver from results where group_id=$1 and giver=$2", g, u).Scan(&giver)
	} else if kind == "incoming" {
		db.QueryRow(ctx, "select giver from results where group_id=$1 and recipient=$2", g, u).Scan(&giver)
	}
	if giver == 0 {
		fail(w, 403, "Conversa indisponível.")
		return
	}
	if r.Method == "POST" {
		var p struct{ Content string }
		if body(r, &p) != nil || len(strings.TrimSpace(p.Content)) == 0 || len(p.Content) > 2000 {
			fail(w, 400, "Escreva uma mensagem de até 2000 caracteres.")
			return
		}
		_, e := db.Exec(ctx, "insert into messages(group_id,giver,sender,content) values($1,$2,$3,$4)", g, giver, u, strings.TrimSpace(p.Content))
		if e != nil {
			fail(w, 500, "Erro ao enviar.")
			return
		}
	}
	var lastRead int64
	readErr := db.QueryRow(ctx, `insert into chat_reads(group_id,giver,user_id,last_read_id) values($1,$2,$3,coalesce((select max(id) from messages where group_id=$1 and giver=$2),0)) on conflict(group_id,giver,user_id) do update set last_read_id=excluded.last_read_id where chat_reads.last_read_id < excluded.last_read_id returning last_read_id`, g, giver, u).Scan(&lastRead)
	if r.Method == "GET" && readErr == nil && lastRead > 0 {
		notifyUpdate(updateEvent{Group: g, Kind: "read", User1: u})
	}
	rows, e := db.Query(ctx, "select id,sender,content,created_at from (select id,sender,content,created_at from messages where group_id=$1 and giver=$2 order by id desc limit 500) recent order by id", g, giver)
	if e != nil {
		fail(w, 500, "Erro ao carregar conversa.")
		return
	}
	defer rows.Close()
	out := []any{}
	for rows.Next() {
		var id, sender int64
		var content string
		var at time.Time
		rows.Scan(&id, &sender, &content, &at)
		out = append(out, map[string]any{"id": id, "mine": sender == u, "content": content, "at": at})
	}
	respond(w, out)
}
