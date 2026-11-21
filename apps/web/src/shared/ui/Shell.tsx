import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { LogOut } from "lucide-react";
import { api } from "../api/client";
import { Brand } from "./Brand";

export function Shell({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    if (pending) return;
    setPending(true);
    try {
      await api("/logout", "POST", {});
      window.location.replace("/login");
    } catch {
      setError("Não foi possível sair. Tente novamente.");
      setPending(false);
    }
  }
  return (
    <div className="app-shell">
      <header className="app-nav">
        <div className="wrap">
          <Brand />
          <nav className="app-nav-actions" aria-label="Navegação da conta">
            <Link to="/app">Meus grupos</Link>
            <button className="nav-logout" onClick={logout} disabled={pending}>
              <LogOut size={16} />
              {pending ? "Saindo..." : "Sair"}
            </button>
          </nav>
        </div>
        {error && (
          <div className="nav-error" role="alert">
            {error}
          </div>
        )}
      </header>
      {children}
    </div>
  );
}
