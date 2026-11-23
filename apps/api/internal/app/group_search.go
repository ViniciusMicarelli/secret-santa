package app

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// searchGroups is scoped to the authenticated member before applying any filter.
func searchGroups(w http.ResponseWriter, r *http.Request) {
	user := require(w, r)
	if user == 0 {
		return
	}
	query := r.URL.Query()
	text := strings.TrimSpace(query.Get("q"))
	participant := strings.TrimSpace(query.Get("participant"))
	status := query.Get("status")
	from, to := query.Get("from"), query.Get("to")
	sort := query.Get("sort")
	if len(text) > 100 || len(participant) > 100 || (from != "" && !validEventDate(from)) || (to != "" && !validEventDate(to)) || (from != "" && to != "" && from > to) {
		fail(w, 400, "Confira os filtros e o intervalo de datas.")
		return
	}
	if status != "" && status != "open" && status != "scheduled" && status != "drawn" && status != "needs_adjustment" {
		fail(w, 400, "Status inválido.")
		return
	}
	order := "g.created_at DESC, g.id DESC"
	switch sort {
	case "", "recent":
	case "oldest":
		order = "g.created_at ASC, g.id ASC"
	case "event_asc":
		order = "NULLIF(g.event_date, '') ASC NULLS LAST, g.id DESC"
	case "event_desc":
		order = "NULLIF(g.event_date, '') DESC NULLS LAST, g.id DESC"
	default:
		fail(w, 400, "Ordenação inválida.")
		return
	}
	page := 1
	if value := query.Get("page"); value != "" {
		var err error
		page, err = strconv.Atoi(value)
		if err != nil || page < 1 || page > 10000 {
			fail(w, 400, "Página inválida.")
			return
		}
	}
	const limit = 12
	const filter = ` FROM groups g JOIN members m ON m.group_id=g.id AND m.user_id=$1
 WHERE ($2='' OR to_tsvector('portuguese'::regconfig, g.name || ' ' || g.description) @@ websearch_to_tsquery('portuguese'::regconfig, $2) OR strpos(lower(g.name || ' ' || g.description), lower($2)) > 0)
 AND ($3='' OR EXISTS (SELECT 1 FROM members pm JOIN users pu ON pu.id=pm.user_id WHERE pm.group_id=g.id AND strpos(lower(pu.name),lower($3))>0))
 AND ($4='' OR ($4='scheduled' AND g.status='open' AND g.scheduled_at IS NOT NULL) OR ($4='open' AND g.status='open' AND g.scheduled_at IS NULL) OR ($4 NOT IN ('open','scheduled') AND g.status=$4))
 AND ($5='' OR (g.event_date <> '' AND g.event_date >= $5)) AND ($6='' OR (g.event_date <> '' AND g.event_date <= $6))`
	args := []any{user, text, participant, status, from, to}
	var total int
	if err := db.QueryRow(ctx, "SELECT count(*)"+filter, args...).Scan(&total); err != nil {
		fail(w, 500, "Não foi possível buscar seus grupos.")
		return
	}
	sql := `SELECT g.id,g.name,g.status,g.event_date,g.scheduled_at,(SELECT count(*) FROM members m2 WHERE m2.group_id=g.id),
 (SELECT count(*) FROM messages msg JOIN results rr ON rr.group_id=msg.group_id AND rr.giver=msg.giver WHERE msg.group_id=g.id AND (rr.giver=$1 OR rr.recipient=$1) AND msg.sender<>$1 AND msg.id>coalesce((SELECT last_read_id FROM chat_reads cr WHERE cr.group_id=msg.group_id AND cr.giver=msg.giver AND cr.user_id=$1),0))` + filter + fmt.Sprintf(" ORDER BY %s LIMIT $7 OFFSET $8", order)
	rows, err := db.Query(ctx, sql, append(args, limit, (page-1)*limit)...)
	if err != nil {
		fail(w, 500, "Não foi possível buscar seus grupos.")
		return
	}
	defer rows.Close()
	items := []any{}
	for rows.Next() {
		var id int64
		var name, state, date string
		var scheduledAt *time.Time
		var count, unread int
		if err = rows.Scan(&id, &name, &state, &date, &scheduledAt, &count, &unread); err != nil {
			fail(w, 500, "Não foi possível buscar seus grupos.")
			return
		}
		items = append(items, map[string]any{"id": id, "name": name, "status": state, "eventDate": date, "scheduledAt": scheduledAt, "count": count, "unread": unread})
	}
	if rows.Err() != nil {
		fail(w, 500, "Não foi possível buscar seus grupos.")
		return
	}
	respond(w, map[string]any{"items": items, "total": total, "page": page, "pageSize": limit, "totalPages": (total + limit - 1) / limit})
}
