import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../../shared/api/client";
import { Shell } from "../../shared/ui/Shell";

export function Security() {
  const [password, SP] = useState(""),
    [codes, SC] = useState<string[]>([]),
    [error, SE] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      const result = await api("/recovery-codes", "POST", { password });
      SC(result.codes);
      SP("");
      SE("");
    } catch (e) {
      SE((e as Error).message);
    }
  }
  return (
    <Shell>
      <main className="wrap app-content">
        <Link className="back" to="/app">
          ← Todos os grupos
        </Link>
        <div className="group-heading">
          <div>
            <div className="kicker">CUIDE DO SEU ACESSO</div>
            <h1>
              Segurança<span className="pink">.</span>
            </h1>
          </div>
        </div>
        <div className="panel security-panel">
          <h2>Códigos de recuperação</h2>
          <p className="panel-copy">
            Gere oito códigos para recuperar sua conta sem e-mail. Guarde-os em
            um local seguro: cada um funciona uma vez e eles aparecem somente
            agora. Gerar novos códigos invalida os anteriores.
          </p>
          {codes.length > 0 && (
            <div className="recovery-codes" role="status">
              <strong>Guarde estes códigos agora</strong>
              {codes.map((c) => (
                <code key={c}>{c}</code>
              ))}
              <button
                className="btn btn-outline"
                onClick={() => navigator.clipboard.writeText(codes.join("\n"))}
              >
                Copiar códigos
              </button>
            </div>
          )}
          <form onSubmit={submit}>
            <label>
              Confirme sua senha
              <input
                type="password"
                value={password}
                onChange={(e) => SP(e.target.value)}
                required
                autoComplete="current-password"
              />
            </label>
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            <button className="btn btn-navy">
              Gerar códigos de recuperação
            </button>
          </form>
        </div>
      </main>
    </Shell>
  );
}
