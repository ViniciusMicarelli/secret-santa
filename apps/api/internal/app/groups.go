package app

import (
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"
)

func member(g, u int64) bool {
	var ok bool
	db.QueryRow(ctx, "select exists(select 1 from members where group_id=$1 and user_id=$2)", g, u).Scan(&ok)
	return ok
}

func owner(g, u int64) bool {
	var ok bool
	db.QueryRow(ctx, "select exists(select 1 from groups where id=$1 and owner_id=$2)", g, u).Scan(&ok)
	return ok
}

func listGroups(w http.ResponseWriter, r *http.Request) {
	u := require(w, r)
	if u == 0 {
		return
	}
	rows, e := db.Query(ctx, `select g.id,g.name,g.status,g.event_date,(select count(*) from members m2 where m2.group_id=g.id),
        (select count(*) from messages msg join results rr on rr.group_id=msg.group_id and rr.giver=msg.giver
         where msg.group_id=g.id and (rr.giver=$1 or rr.recipient=$1) and msg.sender<>$1
         and msg.id>coalesce((select last_read_id from chat_reads cr where cr.group_id=msg.group_id and cr.giver=msg.giver and cr.user_id=$1),0)) from groups g join members m on m.group_id=g.id where m.user_id=$1 order by g.created_at desc`, u)
	if e != nil {
		fail(w, 500, "Erro ao carregar grupos.")
		return
	}
	defer rows.Close()
	out := []any{}
	for rows.Next() {
		var id int64
		var n, s, d string
		var c, unread int
		rows.Scan(&id, &n, &s, &d, &c, &unread)
		out = append(out, map[string]any{"id": id, "name": n, "status": s, "eventDate": d, "count": c, "unread": unread})
	}
	respond(w, out)
}

func createGroup(w http.ResponseWriter, r *http.Request) {
	u := require(w, r)
	if u == 0 {
		return
	}
	var p struct{ Name, Description, EventDate, Budget string }
	if body(r, &p) != nil || len(strings.TrimSpace(p.Name)) < 2 || len(p.Name) > 100 {
		fail(w, 400, "Informe um nome para o grupo.")
		return
	}
	tx, e := db.Begin(ctx)
	if e != nil {
		fail(w, 500, "Erro ao criar grupo.")
		return
	}
	defer tx.Rollback(ctx)
	var id int64
	e = tx.QueryRow(ctx, "insert into groups(name,description,event_date,budget,owner_id,invite) values($1,$2,$3,$4,$5,$6) returning id", strings.TrimSpace(p.Name), p.Description, p.EventDate, p.Budget, u, token()).Scan(&id)
	if e == nil {
		_, e = tx.Exec(ctx, "insert into members(group_id,user_id) values($1,$2)", id, u)
	}
	if e != nil || tx.Commit(ctx) != nil {
		fail(w, 500, "Erro ao criar grupo.")
		return
	}
	respond(w, map[string]any{"id": id})
}

func join(w http.ResponseWriter, r *http.Request) {
	u := require(w, r)
	if u == 0 {
		return
	}
	tx, e := db.Begin(ctx)
	if e != nil {
		fail(w, 500, "Erro ao entrar.")
		return
	}
	defer tx.Rollback(ctx)
	var id int64
	var status string
	var due bool
	e = tx.QueryRow(ctx, "select id,status,coalesce(scheduled_at<=now(),false) from groups where invite=$1 for update", r.PathValue("invite")).Scan(&id, &status, &due)
	if e != nil || (status != "open" && status != "needs_adjustment") || due {
		fail(w, 400, "Convite inválido ou grupo fechado.")
		return
	}
	_, e = tx.Exec(ctx, "insert into members(group_id,user_id) values($1,$2) on conflict do nothing", id, u)
	if e != nil || tx.Commit(ctx) != nil {
		fail(w, 500, "Erro ao entrar.")
		return
	}
	notifyUpdate(updateEvent{Group: id, Kind: "group"})
	respond(w, map[string]any{"id": id})
}

func getGroup(w http.ResponseWriter, r *http.Request) {
	u := require(w, r)
	if u == 0 {
		return
	}
	g := gid(r)
	if !member(g, u) {
		fail(w, 403, "Você não participa deste grupo.")
		return
	}
	var n, d, ev, b, s, inv string
	var o int64
	var sched *time.Time
	db.QueryRow(ctx, "select name,description,event_date,budget,status,invite,owner_id,scheduled_at from groups where id=$1", g).Scan(&n, &d, &ev, &b, &s, &inv, &o, &sched)
	rows, e := db.Query(ctx, "select u.id,u.name,m.family from members m join users u on u.id=m.user_id where m.group_id=$1 order by u.name", g)
	if e != nil {
		fail(w, 500, "Erro ao carregar grupo.")
		return
	}
	defer rows.Close()
	ms := []any{}
	for rows.Next() {
		var id int64
		var name, f string
		rows.Scan(&id, &name, &f)
		ms = append(ms, map[string]any{"id": id, "name": name, "family": f})
	}
	var target int64
	var targetName string
	db.QueryRow(ctx, "select u.id,u.name from results r join users u on u.id=r.recipient where r.group_id=$1 and r.giver=$2", g, u).Scan(&target, &targetName)
	wishes := []any{}
	wr, _ := db.Query(ctx, "select id,user_id,title,detail,link,favorite from wishes where group_id=$1 and (user_id=$2 or user_id=$3) order by id", g, u, target)
	if wr != nil {
		defer wr.Close()
		for wr.Next() {
			var id, who int64
			var title, detail, link string
			var favorite bool
			wr.Scan(&id, &who, &title, &detail, &link, &favorite)
			wishes = append(wishes, map[string]any{"id": id, "userId": who, "title": title, "detail": detail, "link": link, "favorite": favorite})
		}
	}
	respond(w, map[string]any{"id": g, "name": n, "description": d, "eventDate": ev, "budget": b, "status": s, "invite": inv, "owner": o == u, "scheduledAt": sched, "members": ms, "targetId": target, "targetName": targetName, "wishes": wishes, "unread": unreadCounts(g, u)})
}

func family(w http.ResponseWriter, r *http.Request) {
	u := require(w, r)
	if u == 0 {
		return
	}
	g := gid(r)
	if !owner(g, u) {
		fail(w, 403, "Apenas o organizador pode editar.")
		return
	}
	var p struct {
		UserID int64  `json:"userId"`
		Family string `json:"family"`
	}
	if body(r, &p) != nil || len(p.Family) > 80 {
		fail(w, 400, "Dados inválidos.")
		return
	}
	tx, e := db.Begin(ctx)
	if e != nil {
		fail(w, 500, "Erro ao editar.")
		return
	}
	defer tx.Rollback(ctx)
	var allowed bool
	e = tx.QueryRow(ctx, "select status in ('open','needs_adjustment') and (scheduled_at is null or scheduled_at>now()) from groups where id=$1 for update", g).Scan(&allowed)
	if e != nil || !allowed {
		fail(w, 400, "Não foi possível editar.")
		return
	}
	tag, e := tx.Exec(ctx, "update members set family=$1 where group_id=$2 and user_id=$3", strings.TrimSpace(strings.ToLower(p.Family)), g, p.UserID)
	if e != nil || tag.RowsAffected() == 0 || tx.Commit(ctx) != nil {
		fail(w, 400, "Não foi possível editar.")
		return
	}
	respond(w, map[string]bool{"ok": true})
}

func editGroup(w http.ResponseWriter, r *http.Request, fn func(int64, int64) error) {
	u := require(w, r)
	if u == 0 {
		return
	}
	g := gid(r)
	if !owner(g, u) {
		fail(w, 403, "Apenas o organizador pode editar.")
		return
	}
	if e := fn(g, u); e != nil {
		if errors.Is(e, errGroupClosed) {
			fail(w, 400, e.Error())
		} else {
			log.Printf("group update failed: %v", e)
			fail(w, 500, "Não foi possível editar o grupo.")
		}
		return
	}
	respond(w, map[string]bool{"ok": true})
}

func rotateInvite(w http.ResponseWriter, r *http.Request) {
	editGroup(w, r, func(g, u int64) error {
		tag, e := db.Exec(ctx, "update groups set invite=$1 where id=$2 and owner_id=$3 and status in ('open','needs_adjustment') and (scheduled_at is null or scheduled_at>now())", token(), g, u)
		if e != nil {
			return e
		}
		if tag.RowsAffected() == 0 {
			return errGroupClosed
		}
		return nil
	})
}

var errGroupClosed = &groupError{}

type groupError struct{}

func (*groupError) Error() string {
	return "O grupo não pode ser alterado após o sorteio ou no horário agendado."
}

func removeMember(w http.ResponseWriter, r *http.Request) {
	editGroup(w, r, func(g, u int64) error {
		target, e := strconv.ParseInt(r.PathValue("member"), 10, 64)
		if e != nil || target == u {
			return errGroupClosed
		}
		tx, e := db.Begin(ctx)
		if e != nil {
			return e
		}
		defer tx.Rollback(ctx)
		var allowed bool
		e = tx.QueryRow(ctx, "select status in ('open','needs_adjustment') and (scheduled_at is null or scheduled_at>now()) from groups where id=$1 for update", g).Scan(&allowed)
		if e != nil {
			return e
		}
		if !allowed {
			return errGroupClosed
		}
		if _, e = tx.Exec(ctx, "delete from wishes where group_id=$1 and user_id=$2", g, target); e != nil {
			return e
		}
		removed, err := tx.Exec(ctx, "delete from members where group_id=$1 and user_id=$2", g, target)
		if err != nil {
			return err
		}
		if removed.RowsAffected() == 0 {
			return errGroupClosed
		}
		// Revoke the old invitation so a removed participant cannot reuse it.
		if _, err = tx.Exec(ctx, "update groups set invite=$1 where id=$2", token(), g); err != nil {
			return err
		}
		return tx.Commit(ctx)
	})
}
