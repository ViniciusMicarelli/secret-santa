package app

import (
	"crypto/rand"
	"errors"
	"log"
	"math/big"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
)

var errTooFew = errors.New("São necessários pelo menos três participantes.")

var errNoMatch = errors.New("Não há combinação possível. Ajuste as famílias ou participantes.")

func makeDraw(tx pgx.Tx, g int64) error {
	rows, e := tx.Query(ctx, "select user_id,family from members where group_id=$1 order by user_id", g)
	if e != nil {
		return e
	}
	type m struct {
		id int64
		f  string
	}
	a := []m{}
	for rows.Next() {
		var x m
		rows.Scan(&x.id, &x.f)
		a = append(a, x)
	}
	rows.Close()
	if len(a) < 3 {
		return errTooFew
	} // Randomize candidate order using cryptographic randomness.
	for i := len(a) - 1; i > 0; i-- {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(i+1)))
		if err != nil {
			return err
		}
		j := int(n.Int64())
		a[i], a[j] = a[j], a[i]
	}
	match := make([]int, len(a))
	for i := range match {
		match[i] = -1
	}
	var visit func(int, []bool) bool
	visit = func(i int, seen []bool) bool {
		for j := range a {
			if seen[j] || a[i].id == a[j].id || (a[i].f != "" && a[i].f == a[j].f) {
				continue
			}
			seen[j] = true
			if match[j] < 0 || visit(match[j], seen) {
				match[j] = i
				return true
			}
		}
		return false
	}
	for i := range a {
		if !visit(i, make([]bool, len(a))) {
			return errNoMatch
		}
	}
	for j, i := range match {
		if _, e = tx.Exec(ctx, "insert into results(group_id,giver,recipient) values($1,$2,$3)", g, a[i].id, a[j].id); e != nil {
			return e
		}
	}
	_, e = tx.Exec(ctx, "update groups set status='drawn',scheduled_at=null where id=$1", g)
	return e
}

func runDraw(g int64, user int64, scheduled bool) error {
	tx, e := db.Begin(ctx)
	if e != nil {
		return e
	}
	defer tx.Rollback(ctx)
	var status string
	var ownerID int64
	var due bool
	e = tx.QueryRow(ctx, "select status,owner_id,coalesce(scheduled_at<=now(),false) from groups where id=$1 for update", g).Scan(&status, &ownerID, &due)
	if e != nil {
		return errors.New("Grupo não encontrado.")
	}
	if scheduled {
		if status != "open" || !due {
			return errors.New("Agendamento indisponível.")
		}
	} else if ownerID != user || (status != "open" && status != "needs_adjustment") {
		return errors.New("Sorteio indisponível.")
	}
	e = makeDraw(tx, g)
	if e != nil {
		if scheduled && (errors.Is(e, errTooFew) || errors.Is(e, errNoMatch)) {
			if _, updateErr := tx.Exec(ctx, "update groups set status='needs_adjustment',scheduled_at=null where id=$1", g); updateErr == nil {
				_ = tx.Commit(ctx)
			}
		}
		return e
	}
	return tx.Commit(ctx)
}

func drawHandler(w http.ResponseWriter, r *http.Request) {
	u := require(w, r)
	if u == 0 {
		return
	}
	if e := runDraw(gid(r), u, false); e != nil {
		if errors.Is(e, errTooFew) || errors.Is(e, errNoMatch) || e.Error() == "Sorteio indisponível." || e.Error() == "Grupo não encontrado." {
			fail(w, 400, e.Error())
		} else {
			log.Printf("draw failed: %v", e)
			fail(w, 500, "Não foi possível realizar o sorteio.")
		}
		return
	}
	respond(w, map[string]bool{"ok": true})
}

func schedule(w http.ResponseWriter, r *http.Request) {
	u := require(w, r)
	if u == 0 {
		return
	}
	g := gid(r)
	if !owner(g, u) {
		fail(w, 403, "Apenas o organizador pode agendar.")
		return
	}
	var p struct {
		At *time.Time `json:"at"`
	}
	if body(r, &p) != nil || (p.At != nil && !p.At.After(time.Now().Add(time.Minute))) {
		fail(w, 400, "Escolha um horário futuro.")
		return
	}
	tag, e := db.Exec(ctx, "update groups set scheduled_at=$1,status='open' where id=$2 and status in ('open','needs_adjustment') and (scheduled_at is null or scheduled_at>now())", p.At, g)
	if e != nil || tag.RowsAffected() == 0 {
		fail(w, 400, "Não foi possível alterar o agendamento.")
		return
	}
	respond(w, map[string]bool{"ok": true})
}

func processScheduled() {
	rows, e := db.Query(ctx, "select id from groups where status='open' and scheduled_at<=now() limit 100")
	if e != nil {
		log.Print(e)
		return
	}
	ids := []int64{}
	for rows.Next() {
		var id int64
		rows.Scan(&id)
		ids = append(ids, id)
	}
	rows.Close()
	for _, id := range ids {
		e := runDraw(id, 0, true)
		if e != nil {
			log.Printf("scheduled draw %d: %v", id, e)
		}
		if e == nil || errors.Is(e, errTooFew) || errors.Is(e, errNoMatch) {
			notifyUpdate(updateEvent{Group: id, Kind: "group"})
		}
	}
}
