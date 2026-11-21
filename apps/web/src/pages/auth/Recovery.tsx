import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../../shared/api/client";
import { Brand } from "../../shared/ui/Brand";

export function Recovery() {
  const [username, SU] = useState(""),
    [code, SC] = useState(""),
    [password, SP] = useState(""),
    [error, SE] = useState(""),
    [done, SD] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/recovery", "POST", { username, code, password });
      SD(true);
    } catch (e) {
      SE((e as Error).message);
    }
  }
  return (
    <div className="auth-page">
      <header className="wrap nav">
        <Brand />
        <Link to="/login">Voltar para entrar</Link>
      </header>
      <main className="auth-layout">
        <div className="auth-aside">
          <div className="kicker pale">SEU ACESSO</div>
          <h1>
            Vamos trazer você
            <br />
            <em>de volta.</em>
          </h1>
        </div>
        <div className="auth-card">
          <div className="kicker">RECUPERAR CONTA</div>
          <h2>Uma nova senha.</h2>
          {done ? (
            <>
              <p>
                Senha alterada. Todas as sessões anteriores foram encerradas.
              </p>
              <Link className="btn btn-navy" to="/login">
                Entrar na conta
              </Link>
            </>
          ) : (
            <>
              <p>
                Use um dos códigos que você guardou. Cada código funciona uma
                vez.
              </p>
              <form onSubmit={submit}>
                <label>
                  Usuário
                  <input
                    value={username}
                    onChange={(e) => SU(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Código de recuperação
                  <input
                    value={code}
                    onChange={(e) => SC(e.target.value)}
                    required
                    autoComplete="off"
                  />
                </label>
                <label>
                  Nova senha
                  <input
                    type="password"
                    minLength={8}
                    maxLength={72}
                    value={password}
                    onChange={(e) => SP(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </label>
                {error && (
                  <div className="error" role="alert">
                    {error}
                  </div>
                )}
                <button className="btn btn-pink full">Alterar senha</button>
              </form>
              <p className="small">
                Se você não gerou ou perdeu seus códigos, não há recuperação
                automática disponível.
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
