import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import gsap from "gsap";
import { api } from "../../shared/api/client";
import { Brand } from "../../shared/ui/Brand";
import type { User } from "../../shared/types";
import { safeDestination } from "../../app/navigation";

export function Auth({
  register = false,
  setUser,
}: {
  register?: boolean;
  setUser: (u: User) => void;
}) {
  const [name, SN] = useState(""),
    [username, SU] = useState(""),
    [password, SP] = useState(""),
    [error, SE] = useState(""),
    [busy, SB] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();
  const page = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const context = gsap.context(() => {
      gsap.from(".auth-aside > *", {
        y: 18,
        opacity: 0,
        duration: 0.65,
        stagger: 0.09,
        ease: "power2.out",
      });
      gsap.from(".auth-card", {
        y: 24,
        opacity: 0,
        duration: 0.7,
        ease: "power2.out",
      });
    }, page);
    return () => context.revert();
  }, [register]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    SB(true);
    SE("");
    try {
      const u = await api(register ? "/register" : "/login", "POST", {
        name,
        username,
        password,
      });
      setUser(u);
      nav(safeDestination(new URLSearchParams(loc.search).get("voltar")), {
        replace: true,
      });
    } catch (e) {
      SE((e as Error).message);
    } finally {
      SB(false);
    }
  }
  return (
    <div className="auth-page" ref={page}>
      <header className="wrap nav">
        <Brand />
        <Link to="/">Voltar para o início</Link>
      </header>
      <main className="auth-layout">
        <div className="auth-aside">
          <div className="kicker pale">MUITO PRAZER, ENTRE NÓS</div>
          <h1>
            O melhor
            <br />
            ainda está
            <br />
            <em>por vir.</em>
          </h1>
          <p>
            Um lugar para reunir pessoas e criar surpresas que ficam na memória.
          </p>
          <div className="auth-spark">✳</div>
        </div>
        <div className="auth-card">
          <div className="kicker">
            {register ? "COMECE POR AQUI" : "QUE BOM TER VOCÊ DE VOLTA"}
          </div>
          <h2>{register ? "Crie sua conta." : "Entre na sua conta."}</h2>
          <p>
            {register
              ? "Falta pouco para começar a brincadeira."
              : "Seu próximo momento especial espera por você."}
          </p>
          <form onSubmit={submit}>
            {register && (
              <label>
                Seu nome
                <input
                  value={name}
                  onChange={(e) => SN(e.target.value)}
                  placeholder="Como podemos chamar você?"
                  required
                  maxLength={80}
                />
              </label>
            )}
            <label>
              Nome de usuário
              <input
                value={username}
                onChange={(e) => SU(e.target.value)}
                placeholder="Seu nome de usuário"
                required
                minLength={3}
                autoComplete="username"
              />
            </label>
            <label>
              Senha
              <input
                type="password"
                value={password}
                onChange={(e) => SP(e.target.value)}
                placeholder="Pelo menos 8 caracteres"
                required
                minLength={8}
                autoComplete={register ? "new-password" : "current-password"}
              />
            </label>
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            <button className="btn btn-pink full" disabled={busy}>
              {busy ? "Aguarde..." : register ? "Criar minha conta" : "Entrar"}
            </button>
          </form>
          {register && (
            <p className="small">
              Após criar a conta, gere e guarde seus códigos de recuperação na
              área de segurança.
            </p>
          )}
          {!register && (
            <p>
              <Link className="recovery-link" to="/recuperar">
                Esqueci minha senha
              </Link>
            </p>
          )}
          <div className="auth-switch">
            {register ? "Já tem uma conta?" : "Ainda não tem conta?"}{" "}
            <Link
              to={
                (register ? "/login" : "/criar-conta") +
                (loc.pathname.startsWith("/convite/") || loc.search
                  ? "?voltar=" +
                    encodeURIComponent(
                      loc.pathname.startsWith("/convite/")
                        ? loc.pathname
                        : new URLSearchParams(loc.search).get("voltar") ||
                            "/app",
                    )
                  : "")
              }
            >
              {register ? "Entrar" : "Criar conta"}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
