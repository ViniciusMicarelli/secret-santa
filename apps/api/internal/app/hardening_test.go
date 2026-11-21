package app

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRejectsUploadAndInvalidJSON(t *testing.T) {
	handler := security(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var payload struct{ Name string }
		if body(r, &payload) != nil {
			fail(w, 400, "Dados inválidos.")
			return
		}
		respond(w, map[string]bool{"ok": true})
	}))
	cases := []struct {
		contentType, body string
		status            int
	}{
		{"multipart/form-data; boundary=test", "--test\r\nContent-Disposition: form-data; name=\"file\"; filename=\"x.php\"\r\n\r\n<?php echo 1; ?>\r\n--test--\r\n", 415},
		{"application/octet-stream", "malicious content", 415},
		{"application/json", `{"name":"ok"} {"name":"extra"}`, 400},
		{"application/json", `{"name":"` + strings.Repeat("a", 17000) + `"}`, 400},
		{"application/json", `{"name":"ok"}`, 200},
	}
	for _, tc := range cases {
		req := httptest.NewRequest("POST", "http://example.test/api/test", strings.NewReader(tc.body))
		req.Header.Set("Content-Type", tc.contentType)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != tc.status {
			t.Errorf("type %s: got %d, want %d", tc.contentType, rec.Code, tc.status)
		}
	}
}

func TestWishLinksAndCalendarDates(t *testing.T) {
	links := map[string]bool{"": true, "https://example.com/item?q=1": true, "http://example.com": true, "javascript:alert(1)": false, "https://": false, "https://user:pass@example.com": false, "https://example.com\\@evil.test": false, "https://example.com\n": false, "data:text/html,foo": false}
	for link, want := range links {
		if got := validWishLink(link); got != want {
			t.Errorf("link %q: got %v", link, got)
		}
	}
	for date, want := range map[string]bool{"2026-12-25": true, "2026-02-29": false, "2026-13-01": false, "2026-1-01": false} {
		if got := validEventDate(date); got != want {
			t.Errorf("date %q: got %v", date, got)
		}
	}
}

func TestRealtimeConnectionReservation(t *testing.T) {
	key := realtimeKey{group: 801234, user: 901234}
	for i := 0; i < 8; i++ {
		if !reserveRealtime(key) {
			t.Fatal("legitimate reservation rejected")
		}
	}
	t.Cleanup(func() {
		for i := 0; i < 8; i++ {
			releaseRealtime(key)
		}
	})
	if reserveRealtime(key) {
		t.Fatal("limit exceeded")
	}
	other := realtimeKey{group: key.group, user: key.user + 1}
	if !reserveRealtime(other) {
		t.Fatal("different user was blocked")
	}
	releaseRealtime(other)
	releaseRealtime(key)
	if !reserveRealtime(key) {
		t.Fatal("released reservation was not reusable")
	}
}
