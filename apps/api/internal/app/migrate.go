package app

import (
	"embed"
	"fmt"
	"sort"
)

//go:embed migrations/*.sql
var migrations embed.FS

func initDB() error {
	tx, err := db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, "select pg_advisory_xact_lock(716239118)"); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, "create table if not exists schema_migrations(version text primary key, applied_at timestamptz not null default now())"); err != nil {
		return err
	}
	entries, err := migrations.ReadDir("migrations")
	if err != nil {
		return err
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].Name() < entries[j].Name() })
	for _, entry := range entries {
		name := entry.Name()
		var exists bool
		if err = tx.QueryRow(ctx, "select exists(select 1 from schema_migrations where version=$1)", name).Scan(&exists); err != nil {
			return err
		}
		if exists {
			continue
		}
		data, e := migrations.ReadFile("migrations/" + name)
		if e != nil {
			return e
		}
		if _, err = tx.Exec(ctx, string(data)); err != nil {
			return fmt.Errorf("migration %s: %w", name, err)
		}
		if _, err = tx.Exec(ctx, "insert into schema_migrations(version) values($1)", name); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}
