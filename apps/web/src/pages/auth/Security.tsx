import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../../shared/api/client";
import { Shell } from "../../shared/ui/Shell";
import { useDialog } from "../../shared/ui/useDialog";

export function Security() {
  const [password, SP] = useState(""),
    [codes, SC] = useState<string[]>([]),
    [error, SE] = useState("");
  const [logoutPassword, setLogoutPassword] = useState("");
  const [logoutError, setLogoutError] = useState("");
  const [logoutBusy, setLogoutBusy] = useState(false);
  const { ask, dialog } = useDialog();
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
  async function logoutEverywhere(e: FormEvent) {
    e.preventDefault();
    if (logoutBusy) return;
    const confirmed = await ask({
      title: "Encerrar todas as sessões?",
      description:
        "Você sairá desta conta em todos os aparelhos, inclusive neste.",
      confirm: "Encerrar sessões",
    });
    if (confirmed === null) return;
    setLogoutBusy(true);
    setLogoutError("");
    try {
      await api("/logout-all", "POST", { password: logoutPassword });
      window.location.replace("/login");
    } catch (e) {
      setLogoutError((e as Error).message);
      setLogoutBusy(false);
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
              <p>
                Cada linha contém um código independente, válido para uma única
                recuperação.
              </p>
              <ol className="recovery-code-list">
                {codes.map((c) => (
                  <li key={c}>
                    <code>{c}</code>
                  </li>
                ))}
              </ol>
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
        <div className="panel security-panel">
          <h2>Seus dispositivos</h2>
          <p className="panel-copy">
            Se perdeu um aparelho ou suspeita de acesso indevido, encerre todas
            as sessões. Você precisará entrar novamente.
          </p>
          <form onSubmit={logoutEverywhere}>
            <label>
              Sua senha
              <input
                type="password"
                value={logoutPassword}
                onChange={(e) => setLogoutPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </label>
            {logoutError && (
              <div className="error" role="alert">
                {logoutError}
              </div>
            )}
            <button className="btn btn-outline" disabled={logoutBusy}>
              {logoutBusy ? "Encerrando..." : "Sair de todos os dispositivos"}
            </button>
          </form>
        </div>
        {dialog}
      </main>
    </Shell>
  );
}
