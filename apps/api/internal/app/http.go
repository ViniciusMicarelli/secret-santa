package app

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
)

func token() string {
	b := make([]byte, 32)
	if _, e := rand.Read(b); e != nil {
		panic(e)
	}
	return hex.EncodeToString(b)
}

func hash(s string) string { h := sha256.Sum256([]byte(s)); return hex.EncodeToString(h[:]) }

func respond(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func fail(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	respond(w, map[string]string{"error": msg})
}

func body(r *http.Request, v any) error {
	r.Body = http.MaxBytesReader(nil, r.Body, 16384)
	decoder := json.NewDecoder(r.Body)
	if err := decoder.Decode(v); err != nil {
		return err
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		if err == nil {
			return io.ErrUnexpectedEOF
		}
		return err
	}
	return nil
}

func newHandler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) { respond(w, map[string]string{"status": "ok"}) })
	mux.HandleFunc("POST /api/register", auth)
	mux.HandleFunc("POST /api/login", auth)
	mux.HandleFunc("POST /api/recovery", recoverAccount)
	mux.HandleFunc("POST /api/recovery-codes", recoveryCodes)
	mux.HandleFunc("POST /api/logout-all", logoutAll)
	mux.HandleFunc("POST /api/logout", func(w http.ResponseWriter, r *http.Request) {
		if c, e := r.Cookie("session"); e == nil {
			if _, err := db.Exec(ctx, "delete from sessions where token=$1", hash(c.Value)); err != nil {
				fail(w, 500, "Não foi possível encerrar a sessão.")
				return
			}
		}
		http.SetCookie(w, &http.Cookie{Name: "session", Path: "/", MaxAge: -1, HttpOnly: true, Secure: os.Getenv("ENV") == "production", SameSite: http.SameSiteLaxMode})
		respond(w, map[string]bool{"ok": true})
	})
	mux.HandleFunc("GET /api/me", func(w http.ResponseWriter, r *http.Request) {
		id := require(w, r)
		if id == 0 {
			return
		}
		var n, u string
		db.QueryRow(ctx, "select name,username from users where id=$1", id).Scan(&n, &u)
		respond(w, map[string]any{"id": id, "name": n, "username": u})
	})
	mux.HandleFunc("GET /api/groups", listGroups)
	mux.HandleFunc("GET /api/groups/search", searchGroups)
	mux.HandleFunc("GET /api/events", accountEvents)
	mux.HandleFunc("POST /api/groups", createGroup)
	mux.HandleFunc("POST /api/join/{invite}", join)
	mux.HandleFunc("GET /api/groups/{id}", getGroup)
	mux.HandleFunc("GET /api/groups/{id}/events", groupEvents)
	mux.HandleFunc("POST /api/groups/{id}/family", family)
	mux.HandleFunc("POST /api/groups/{id}/invite", rotateInvite)
	mux.HandleFunc("DELETE /api/groups/{id}/members/{member}", removeMember)
	mux.HandleFunc("POST /api/groups/{id}/wish/{wish}/favorite", favoriteWish)
	mux.HandleFunc("POST /api/groups/{id}/chat/{kind}/report", reportChat)
	mux.HandleFunc("POST /api/groups/{id}/draw", drawHandler)
	mux.HandleFunc("POST /api/groups/{id}/schedule", schedule)
	mux.HandleFunc("POST /api/groups/{id}/wish", wish)
	mux.HandleFunc("DELETE /api/groups/{id}/wish/{wish}", deleteWish)
	mux.HandleFunc("PUT /api/groups/{id}/wish/{wish}", updateWish)
	mux.HandleFunc("GET /api/groups/{id}/chat/{kind}", chat)
	mux.HandleFunc("POST /api/groups/{id}/chat/{kind}", chat)
	return security(broadcastMutations(mux))
}

func security(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("Cache-Control", "no-store")
		if r.Method != "GET" {
			if origin := r.Header.Get("Origin"); origin != "" {
				parsed, err := url.Parse(origin)
				if err != nil || parsed.Host != r.Host || (parsed.Scheme != "http" && parsed.Scheme != "https") {
					fail(w, 403, "Origem não permitida.")
					return
				}
			}
			key := ""
			limit := 0
			if r.URL.Path == "/api/login" || r.URL.Path == "/api/register" || r.URL.Path == "/api/recovery" {
				ip, _, err := net.SplitHostPort(r.RemoteAddr)
				if err != nil {
					ip = r.RemoteAddr
				}
				if os.Getenv("TRUST_PROXY") == "true" {
					if parsed := net.ParseIP(r.Header.Get("X-Real-IP")); parsed != nil {
						ip = parsed.String()
					}
				}
				key = "auth:" + ip
				limit = 30
			} else if r.URL.Path == "/api/recovery-codes" {
				if u := uid(r); u != 0 {
					key = "recovery-codes:" + strconv.FormatInt(u, 10)
					limit = 10
				}
			} else if r.URL.Path == "/api/logout-all" {
				if u := uid(r); u != 0 {
					key = "logout-all:" + strconv.FormatInt(u, 10)
					limit = 10
				}
			} else if strings.Contains(r.URL.Path, "/chat/") {
				if u := uid(r); u != 0 {
					key = "chat:" + strconv.FormatInt(u, 10)
					limit = 60
				}
			}
			if key != "" {
				var count int
				err := db.QueryRow(ctx, `insert into rate_limits(key,count,window_start) values($1,1,now()) on conflict(key) do update set count=case when rate_limits.window_start < now()-interval '10 minutes' then 1 else rate_limits.count+1 end, window_start=case when rate_limits.window_start < now()-interval '10 minutes' then now() else rate_limits.window_start end returning count`, key).Scan(&count)
				if err != nil {
					fail(w, 503, "Serviço temporariamente indisponível.")
					return
				}
				if count > limit {
					w.Header().Set("Retry-After", "600")
					fail(w, 429, "Muitas tentativas. Tente novamente mais tarde.")
					return
				}
			}
		}
		if r.Method != "GET" && r.Header.Get("Content-Type") != "application/json" {
			fail(w, 415, "Conteúdo inválido.")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func gid(r *http.Request) int64 { i, _ := strconv.ParseInt(r.PathValue("id"), 10, 64); return i }
