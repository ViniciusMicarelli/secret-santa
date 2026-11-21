package app

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var db *pgxpool.Pool

var ctx = context.Background()

func Run() {
	var e error
	db, e = pgxpool.New(ctx, os.Getenv("DATABASE_URL"))
	if e != nil {
		log.Fatal(e)
	}
	defer db.Close()
	if e = db.Ping(ctx); e != nil {
		log.Fatal(e)
	}
	if e = initDB(); e != nil {
		log.Fatal(e)
	}
	handler := newHandler()
	go listenUpdates(ctx, nil)
	go func() {
		for {
			processScheduled()
			time.Sleep(time.Minute)
		}
	}()
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("listening on %s", port)
	server := &http.Server{Addr: ":" + port, Handler: handler, ReadHeaderTimeout: 10 * time.Second, IdleTimeout: 90 * time.Second, MaxHeaderBytes: 1 << 20}
	log.Fatal(server.ListenAndServe())
}
