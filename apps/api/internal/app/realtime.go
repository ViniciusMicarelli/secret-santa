package app

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type updateEvent struct {
	Group int64  `json:"group"`
	Kind  string `json:"kind"`
	User1 int64  `json:"user1,omitempty"`
	User2 int64  `json:"user2,omitempty"`
}
type realtimeClient struct {
	group, user int64
	session     string
	conn        *websocket.Conn
	send        chan string
}

var realtime = struct {
	sync.Mutex
	clients      map[*realtimeClient]struct{}
	reservations map[realtimeKey]int
}{clients: make(map[*realtimeClient]struct{}), reservations: make(map[realtimeKey]int)}

type realtimeKey struct{ group, user int64 }

// Bound simultaneous sockets for one account and group on this API instance.
func reserveRealtime(key realtimeKey) bool {
	realtime.Lock()
	defer realtime.Unlock()
	if realtime.reservations[key] >= 8 {
		return false
	}
	realtime.reservations[key]++
	return true
}
func releaseRealtime(key realtimeKey) {
	realtime.Lock()
	defer realtime.Unlock()
	if realtime.reservations[key] <= 1 {
		delete(realtime.reservations, key)
	} else {
		realtime.reservations[key]--
	}
}

var upgrader = websocket.Upgrader{CheckOrigin: func(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return false
	}
	u, e := url.Parse(origin)
	return e == nil && u.Host == r.Host && (u.Scheme == "http" || u.Scheme == "https")
}}

// Only invalidation messages are published. Clients retrieve private data through
// the normal authenticated endpoints. PostgreSQL distributes events to all API instances.
func notifyUpdate(e updateEvent) {
	payload, err := json.Marshal(e)
	if err != nil {
		return
	}
	if _, err = db.Exec(ctx, "select pg_notify('entre_nos_updates',$1)", string(payload)); err != nil {
		log.Printf("realtime notification failed: %v", err)
		// Force a refresh after reconnect if delivery could not be published.
		realtime.Lock()
		for client := range realtime.clients {
			client.conn.Close()
		}
		realtime.Unlock()
	}
}
func listenUpdates(ctx context.Context, ready chan<- struct{}) {
	announced := false
	for ctx.Err() == nil {
		conn, e := db.Acquire(ctx)
		if e != nil {
			log.Printf("realtime connection: %v", e)
			select {
			case <-ctx.Done():
				return
			case <-time.After(time.Second * 2):
				continue
			}
		}
		_, e = conn.Exec(ctx, "listen entre_nos_updates")
		if e == nil {
			if !announced && ready != nil {
				close(ready)
				announced = true
			}
			for {
				var nErr error
				n, nErr := conn.Conn().WaitForNotification(ctx)
				if nErr != nil {
					e = nErr
					break
				}
				var event updateEvent
				if json.Unmarshal([]byte(n.Payload), &event) == nil {
					dispatchUpdate(event)
				}
			}
		}
		// Reconnect sockets so that clients refresh state after any listener gap.
		realtime.Lock()
		for client := range realtime.clients {
			client.conn.Close()
		}
		realtime.Unlock()
		if ctx.Err() != nil {
			cleanupCtx, cancel := context.WithTimeout(context.Background(), time.Second)
			_, _ = conn.Exec(cleanupCtx, "unlisten entre_nos_updates")
			cancel()
		}
		conn.Release()
		if ctx.Err() == nil {
			log.Printf("realtime listener disconnected: %v", e)
			select {
			case <-ctx.Done():
				return
			case <-time.After(time.Second * 2):
			}
		}
	}
}
func dispatchUpdate(event updateEvent) {
	realtime.Lock()
	defer realtime.Unlock()
	for c := range realtime.clients {
		if c.group != event.Group {
			continue
		}
		if (event.Kind == "chat" || event.Kind == "read") && c.user != event.User1 && c.user != event.User2 {
			continue
		}
		kind := event.Kind
		if kind != "chat" && kind != "read" {
			kind = "group"
		}
		select {
		case c.send <- kind:
		default: // A slow client must reconnect and refresh rather than miss events.
			c.conn.Close()
		}
	}
}
func validClient(c *realtimeClient) bool {
	var valid bool
	err := db.QueryRow(ctx, `select exists(select 1 from sessions s join members m on m.user_id=s.user_id where s.token=$1 and s.user_id=$2 and s.expires_at>now() and m.group_id=$3)`, c.session, c.user, c.group).Scan(&valid)
	return err == nil && valid
}
func groupEvents(w http.ResponseWriter, r *http.Request) {
	user := require(w, r)
	if user == 0 {
		return
	}
	group := gid(r)
	if !member(group, user) {
		fail(w, 403, "Você não participa deste grupo.")
		return
	}
	cookie, e := r.Cookie("session")
	if e != nil {
		fail(w, 401, "Entre na sua conta.")
		return
	}
	key := realtimeKey{group: group, user: user}
	if !reserveRealtime(key) {
		fail(w, http.StatusTooManyRequests, "Muitas conexões abertas neste grupo.")
		return
	}
	defer releaseRealtime(key)
	conn, e := upgrader.Upgrade(w, r, nil)
	if e != nil {
		return
	}
	c := &realtimeClient{group: group, user: user, session: hash(cookie.Value), conn: conn, send: make(chan string, 16)}
	realtime.Lock()
	realtime.clients[c] = struct{}{}
	realtime.Unlock()
	defer func() { realtime.Lock(); delete(realtime.clients, c); realtime.Unlock(); conn.Close() }()
	conn.SetReadLimit(1024)
	conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.SetPongHandler(func(string) error { return conn.SetReadDeadline(time.Now().Add(60 * time.Second)) })
	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	}()
	ticker := time.NewTicker(25 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-done:
			return
		case kind := <-c.send:
			if !validClient(c) {
				return
			}
			conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
			if conn.WriteJSON(map[string]string{"type": kind}) != nil {
				return
			}
		case <-ticker.C:
			if !validClient(c) {
				return
			}
			conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
			if conn.WriteMessage(websocket.PingMessage, nil) != nil {
				return
			}
		}
	}
}

type statusCapture struct {
	http.ResponseWriter
	status int
}

func (w *statusCapture) WriteHeader(code int) { w.status = code; w.ResponseWriter.WriteHeader(code) }
func (w *statusCapture) Write(b []byte) (int, error) {
	if w.status == 0 {
		w.status = 200
	}
	return w.ResponseWriter.Write(b)
}
func broadcastMutations(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "GET" {
			next.ServeHTTP(w, r)
			return
		}
		capture := &statusCapture{ResponseWriter: w}
		next.ServeHTTP(capture, r)
		if capture.status < 200 || capture.status >= 300 {
			return
		}
		g := gid(r)
		if g == 0 {
			return
		}
		if strings.Contains(r.URL.Path, "/chat/") {
			if strings.HasSuffix(r.URL.Path, "/report") {
				return
			}
			u := uid(r)
			giver := conversationGiver(g, u, r.PathValue("kind"))
			var recipient int64
			db.QueryRow(ctx, "select recipient from results where group_id=$1 and giver=$2", g, giver).Scan(&recipient)
			if giver != 0 && recipient != 0 {
				notifyUpdate(updateEvent{Group: g, Kind: "chat", User1: giver, User2: recipient})
			}
			return
		}
		notifyUpdate(updateEvent{Group: g, Kind: "group"})
	})
}
