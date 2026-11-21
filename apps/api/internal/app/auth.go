package app

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"os"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

func uid(r *http.Request) int64 {
	c, e := r.Cookie("session")
	if e != nil {
		return 0
	}
	var id int64
	db.QueryRow(ctx, "select user_id from sessions where token=$1 and expires_at>now()", hash(c.Value)).Scan(&id)
	return id
}

func require(w http.ResponseWriter, r *http.Request) int64 {
	id := uid(r)
	if id == 0 {
		fail(w, 401, "Entre na sua conta para continuar.")
	}
	return id
}

func session(w http.ResponseWriter, id int64) error {
	t := token()
	if _, err := db.Exec(ctx, "insert into sessions(token,user_id,expires_at) values($1,$2,now()+interval '30 days')", hash(t), id); err != nil {
		return err
	}
	http.SetCookie(w, &http.Cookie{Name: "session", Value: t, Path: "/", HttpOnly: true, Secure: os.Getenv("ENV") == "production", SameSite: http.SameSiteLaxMode, MaxAge: 2592000})
	return nil
}

func auth(w http.ResponseWriter, r *http.Request) {
	var p struct{ Username, Name, Password string }
	if body(r, &p) != nil {
		fail(w, 400, "Dados inválidos.")
		return
	}
	p.Username = strings.ToLower(strings.TrimSpace(p.Username))
	if len(p.Username) < 3 || len(p.Username) > 40 || len(p.Password) < 8 || len(p.Password) > 72 {
		fail(w, 400, "Use usuário com 3 a 40 caracteres e senha com 8 a 72 caracteres.")
		return
	}
	var id int64
	var name, pass string
	if r.URL.Path == "/api/register" {
		p.Name = strings.TrimSpace(p.Name)
		if len(p.Name) < 2 || len(p.Name) > 80 {
			fail(w, 400, "Informe seu nome.")
			return
		}
		b, _ := bcrypt.GenerateFromPassword([]byte(p.Password), bcrypt.DefaultCost)
		e := db.QueryRow(ctx, "insert into users(username,name,password) values($1,$2,$3) returning id", p.Username, p.Name, string(b)).Scan(&id)
		if e != nil {
			fail(w, 409, "Não foi possível criar a conta. Experimente outro usuário.")
			return
		}
		name = p.Name
	} else {
		e := db.QueryRow(ctx, "select id,name,password from users where username=$1", p.Username).Scan(&id, &name, &pass)
		// Perform a bcrypt comparison for unknown users as well to reduce username enumeration by timing.
		if e != nil {
			pass = "$2a$10$t/rwvJFqH9ukHgh6PzcZQ.pmInQlyCkM7UJaDGb0baTxRDAIKtLFS"
		}
		passwordErr := bcrypt.CompareHashAndPassword([]byte(pass), []byte(p.Password))
		if e != nil || passwordErr != nil {
			fail(w, 401, "Usuário ou senha inválidos.")
			return
		}
	}
	if err := session(w, id); err != nil {
		fail(w, 500, "Não foi possível iniciar a sessão.")
		return
	}
	respond(w, map[string]any{"id": id, "name": name, "username": p.Username})
}

func recoveryCodes(w http.ResponseWriter, r *http.Request) {
	u := require(w, r)
	if u == 0 {
		return
	}
	var p struct{ Password string }
	if body(r, &p) != nil {
		fail(w, 400, "Dados inválidos.")
		return
	}
	var pass string
	if db.QueryRow(ctx, "select password from users where id=$1", u).Scan(&pass) != nil || bcrypt.CompareHashAndPassword([]byte(pass), []byte(p.Password)) != nil {
		fail(w, 401, "Senha incorreta.")
		return
	}
	tx, e := db.Begin(ctx)
	if e != nil {
		fail(w, 500, "Erro ao gerar códigos.")
		return
	}
	defer tx.Rollback(ctx)
	if e = tx.QueryRow(ctx, "select password from users where id=$1 for update", u).Scan(&pass); e != nil || bcrypt.CompareHashAndPassword([]byte(pass), []byte(p.Password)) != nil {
		fail(w, 401, "Senha incorreta.")
		return
	}
	if _, e = tx.Exec(ctx, "delete from recovery_codes where user_id=$1", u); e != nil {
		fail(w, 500, "Erro ao gerar códigos.")
		return
	}
	codes := []string{}
	for i := 0; i < 8; i++ {
		b := make([]byte, 16)
		if _, e = rand.Read(b); e != nil {
			fail(w, 500, "Erro ao gerar códigos.")
			return
		}
		code := hex.EncodeToString(b)
		codes = append(codes, code)
		if _, e = tx.Exec(ctx, "insert into recovery_codes(user_id,code_hash) values($1,$2)", u, hash(code)); e != nil {
			fail(w, 500, "Erro ao gerar códigos.")
			return
		}
	}
	if tx.Commit(ctx) != nil {
		fail(w, 500, "Erro ao gerar códigos.")
		return
	}
	respond(w, map[string]any{"codes": codes})
}

// Allow the account holder to invalidate sessions on all devices.
func logoutAll(w http.ResponseWriter, r *http.Request) {
	u := require(w, r)
	if u == 0 {
		return
	}
	var p struct{ Password string }
	if body(r, &p) != nil || len(p.Password) == 0 || len(p.Password) > 72 {
		fail(w, 400, "Informe sua senha.")
		return
	}
	var pass string
	if db.QueryRow(ctx, "select password from users where id=$1", u).Scan(&pass) != nil || bcrypt.CompareHashAndPassword([]byte(pass), []byte(p.Password)) != nil {
		fail(w, 401, "Senha incorreta.")
		return
	}
	if _, err := db.Exec(ctx, "delete from sessions where user_id=$1", u); err != nil {
		fail(w, 500, "Não foi possível encerrar as sessões.")
		return
	}
	http.SetCookie(w, &http.Cookie{Name: "session", Path: "/", MaxAge: -1, HttpOnly: true, Secure: os.Getenv("ENV") == "production", SameSite: http.SameSiteLaxMode})
	respond(w, map[string]bool{"ok": true})
}

func recoverAccount(w http.ResponseWriter, r *http.Request) {
	var p struct{ Username, Code, Password string }
	if body(r, &p) != nil || len(p.Password) < 8 || len(p.Password) > 72 {
		fail(w, 400, "Informe os dados e uma senha de 8 a 72 caracteres.")
		return
	}
	newPass, e := bcrypt.GenerateFromPassword([]byte(p.Password), bcrypt.DefaultCost)
	if e != nil {
		fail(w, 500, "Não foi possível recuperar a conta.")
		return
	}
	tx, e := db.Begin(ctx)
	if e != nil {
		fail(w, 500, "Não foi possível recuperar a conta.")
		return
	}
	defer tx.Rollback(ctx)
	var user int64
	if e = tx.QueryRow(ctx, "select id from users where username=$1 for update", strings.ToLower(strings.TrimSpace(p.Username))).Scan(&user); e != nil {
		fail(w, 400, "Usuário ou código de recuperação inválido.")
		return
	}
	e = tx.QueryRow(ctx, "delete from recovery_codes where code_hash=$1 and user_id=$2 returning user_id", hash(strings.TrimSpace(p.Code)), user).Scan(&user)
	if e != nil {
		fail(w, 400, "Usuário ou código de recuperação inválido.")
		return
	}
	if _, e = tx.Exec(ctx, "update users set password=$1 where id=$2", string(newPass), user); e == nil {
		_, e = tx.Exec(ctx, "delete from sessions where user_id=$1", user)
	}
	if e != nil || tx.Commit(ctx) != nil {
		fail(w, 500, "Não foi possível recuperar a conta.")
		return
	}
	respond(w, map[string]bool{"ok": true})
}

// Group row lock serializes changes with joining and drawing.
