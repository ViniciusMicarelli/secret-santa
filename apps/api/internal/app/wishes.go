package app

import (
	"net/http"
	"strconv"
	"strings"
)

func wish(w http.ResponseWriter, r *http.Request) {
	u := require(w, r)
	if u == 0 {
		return
	}
	g := gid(r)
	if !member(g, u) {
		fail(w, 403, "Acesso negado.")
		return
	}
	var p struct{ Title, Detail, Link string }
	if body(r, &p) != nil || len(strings.TrimSpace(p.Title)) < 1 || len(p.Title) > 160 || len(p.Detail) > 500 || len(p.Link) > 1000 || (p.Link != "" && !strings.HasPrefix(p.Link, "https://") && !strings.HasPrefix(p.Link, "http://")) {
		fail(w, 400, "Confira os dados da ideia.")
		return
	}
	tx, e := db.Begin(ctx)
	if e != nil {
		fail(w, 500, "Erro ao salvar.")
		return
	}
	defer tx.Rollback(ctx)
	var locked int
	if e = tx.QueryRow(ctx, "select 1 from members where group_id=$1 and user_id=$2 for update", g, u).Scan(&locked); e != nil {
		fail(w, 403, "Acesso negado.")
		return
	}
	var count int
	tx.QueryRow(ctx, "select count(*) from wishes where group_id=$1 and user_id=$2", g, u).Scan(&count)
	if count >= 5 {
		fail(w, 400, "Você pode adicionar até cinco ideias.")
		return
	}
	_, e = tx.Exec(ctx, "insert into wishes(group_id,user_id,title,detail,link) values($1,$2,$3,$4,$5)", g, u, p.Title, p.Detail, p.Link)
	if e != nil || tx.Commit(ctx) != nil {
		fail(w, 500, "Erro ao salvar.")
		return
	}
	respond(w, map[string]bool{"ok": true})
}

func updateWish(w http.ResponseWriter, r *http.Request) {
	u := require(w, r)
	if u == 0 {
		return
	}
	g := gid(r)
	id, e := strconv.ParseInt(r.PathValue("wish"), 10, 64)
	if e != nil || !member(g, u) {
		fail(w, 403, "Acesso negado.")
		return
	}
	var p struct{ Title, Detail, Link string }
	if body(r, &p) != nil || len(strings.TrimSpace(p.Title)) < 1 || len(p.Title) > 160 || len(p.Detail) > 500 || len(p.Link) > 1000 || (p.Link != "" && !strings.HasPrefix(p.Link, "https://") && !strings.HasPrefix(p.Link, "http://")) {
		fail(w, 400, "Confira os dados da ideia.")
		return
	}
	tag, e := db.Exec(ctx, "update wishes set title=$1,detail=$2,link=$3 where id=$4 and group_id=$5 and user_id=$6", strings.TrimSpace(p.Title), p.Detail, p.Link, id, g, u)
	if e != nil {
		fail(w, 500, "Erro ao salvar.")
		return
	}
	if tag.RowsAffected() == 0 {
		fail(w, 404, "Ideia não encontrada.")
		return
	}
	respond(w, map[string]bool{"ok": true})
}

func deleteWish(w http.ResponseWriter, r *http.Request) {
	u := require(w, r)
	if u == 0 {
		return
	}
	g := gid(r)
	id, err := strconv.ParseInt(r.PathValue("wish"), 10, 64)
	if err != nil || !member(g, u) {
		fail(w, 403, "Acesso negado.")
		return
	}
	tag, err := db.Exec(ctx, "delete from wishes where id=$1 and group_id=$2 and user_id=$3", id, g, u)
	if err != nil {
		fail(w, 500, "Erro ao remover ideia.")
		return
	}
	if tag.RowsAffected() == 0 {
		fail(w, 404, "Ideia não encontrada.")
		return
	}
	respond(w, map[string]bool{"ok": true})
}

func favoriteWish(w http.ResponseWriter, r *http.Request) {
	u := require(w, r)
	if u == 0 {
		return
	}
	g := gid(r)
	id, e := strconv.ParseInt(r.PathValue("wish"), 10, 64)
	if e != nil || !member(g, u) {
		fail(w, 403, "Acesso negado.")
		return
	}
	tx, e := db.Begin(ctx)
	if e != nil {
		fail(w, 500, "Erro ao salvar.")
		return
	}
	defer tx.Rollback(ctx)
	var exists bool
	e = tx.QueryRow(ctx, "select exists(select 1 from wishes where id=$1 and group_id=$2 and user_id=$3)", id, g, u).Scan(&exists)
	if e != nil || !exists {
		fail(w, 404, "Ideia não encontrada.")
		return
	}
	_, e = tx.Exec(ctx, "select 1 from members where group_id=$1 and user_id=$2 for update", g, u)
	if e == nil {
		_, e = tx.Exec(ctx, "update wishes set favorite=false where group_id=$1 and user_id=$2", g, u)
	}
	if e == nil {
		_, e = tx.Exec(ctx, "update wishes set favorite=true where id=$1 and group_id=$2 and user_id=$3", id, g, u)
	}
	if e != nil || tx.Commit(ctx) != nil {
		fail(w, 500, "Erro ao salvar.")
		return
	}
	respond(w, map[string]bool{"ok": true})
}
