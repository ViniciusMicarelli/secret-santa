import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  Gift,
  LockKeyhole,
  Menu,
  MessageCircle,
  Plus,
  Users,
  X,
} from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { Brand } from "../../shared/ui/Brand";
import type { User } from "../../shared/types";
import { Snow } from "../../shared/ui/Snow";
import { FrostedCard } from "../../components/ui/frosted-card";
import { Intro } from "./Intro";
import { ScratchCard } from "../../features/reveal/ScratchCard";
gsap.registerPlugin(ScrollTrigger);

export function Landing({ user }: { user: User | null }) {
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ anchors: true });
    lenis.on("scroll", ScrollTrigger.update);
    let frame = 0;
    function raf(t: number) {
      lenis.raf(t);
      frame = requestAnimationFrame(raf);
    }
    frame = requestAnimationFrame(raf);
    const introDelay = document.querySelector(".intro") ? 1.35 : 0;
    const ctx = gsap.context(() => {
      gsap.from(".headline-line > span", {
        yPercent: 110,
        duration: 1,
        stagger: 0.13,
        delay: introDelay + 0.15,
        ease: "power4.out",
      });
      gsap.utils
        .toArray<HTMLElement>(
          ".section-head h2, .experience-copy h2, .feature-grid h2, .faq-grid h2, .cta h2",
        )
        .forEach((heading) => {
          gsap.from(heading, {
            scrollTrigger: { trigger: heading, start: "top 90%", once: true },
            y: 24,
            opacity: 0,
            duration: 0.8,
            ease: "power3.out",
          });
        });
      const reveal = gsap.timeline({
        scrollTrigger: {
          trigger: ".hero-art",
          start: () => (window.innerWidth <= 800 ? "top 80%" : "top top"),
          end: () => (window.innerWidth <= 800 ? "bottom 15%" : "bottom top"),
          scrub: 0.7,
        },
      });
      reveal
        .to(
          ".gift-lid, .bow, .bow-knot",
          { y: -105, rotation: -5, ease: "none" },
          0,
        )
        .to(".gift-glow", { opacity: 0.9, scale: 1.3, ease: "none" }, 0)
        .to(
          ".gift-surprise",
          { y: -95, opacity: 1, rotation: 10, ease: "none" },
          0,
        );
      gsap.from(".hero-copy > :not(h1)", {
        y: 25,
        opacity: 0,
        duration: 0.8,
        stagger: 0.1,
        delay: introDelay,
        ease: "power3.out",
      });
      gsap.from(".hero-art", {
        y: 35,
        scale: 0.95,
        opacity: 0,
        duration: 1.1,
        delay: introDelay + 0.1,
        ease: "power3.out",
      });
      gsap.from(".steps article", {
        scrollTrigger: { trigger: ".steps", start: "top 85%", once: true },
        y: 35,
        opacity: 0,
        duration: 0.75,
        stagger: 0.14,
        ease: "power3.out",
      });
      gsap.from(".feature-list article", {
        scrollTrigger: {
          trigger: ".feature-list",
          start: "top 85%",
          once: true,
        },
        y: 25,
        opacity: 0,
        duration: 0.65,
        stagger: 0.12,
        ease: "power3.out",
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
      ctx.revert();
    };
  }, []);
  return (
    <div className="landing">
      <Intro />
      <Snow />
      <div className="holiday-banner">
        ✦ &nbsp; UMA TEMPORADA FEITA PARA ESTAR JUNTO &nbsp; ✦
      </div>
      <header className="nav wrap">
        <Brand />
        <button
          className="mobile-menu"
          onClick={() => setMenu(!menu)}
          aria-label={menu ? "Fechar menu" : "Abrir menu"}
          aria-expanded={menu}
          aria-controls="landing-nav"
        >
          {menu ? <X /> : <Menu />}
        </button>
        <nav
          id="landing-nav"
          className={menu ? "navlinks shown" : "navlinks"}
          onClick={() => setMenu(false)}
        >
          <a href="#como">Como funciona</a>
          <a href="#recursos">A experiência</a>
          <a href="#duvidas">Dúvidas</a>
          <Link to={user ? "/app" : "/login"}>
            {user ? "Meus grupos" : "Entrar"}
          </Link>
          <Link
            className="btn btn-small btn-light"
            to={user ? "/app" : "/criar-conta"}
          >
            Começar
          </Link>
        </nav>
      </header>
      <main>
        <section className="hero wrap">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="dot" /> A MAGIA DE ESTAR JUNTO COMEÇA AQUI
            </div>
            <h1>
              <span className="headline-line">
                <span>Neste Natal,</span>
              </span>
              <span className="headline-line">
                <span>o presente é</span>
              </span>
              <span className="headline-line">
                <span>
                  <em>estar junto.</em>
                  <span className="hero-star">✳</span>
                </span>
              </span>
            </h1>
            <p>
              Reúna quem faz seu ano mais especial. A gente cuida do sorteio,
              você fica com a parte boa: surpreender.
            </p>
            <div className="hero-actions">
              <Link
                className="btn btn-pink"
                to={user ? "/app" : "/criar-conta"}
              >
                Criar meu grupo
              </Link>
              <a className="text-link" href="#como">
                Descubra como funciona
              </a>
            </div>
            <div className="hero-note">
              <div className="avatars">
                <b>A</b>
                <b>M</b>
                <b>J</b>
                <b>✳</b>
              </div>
              <span>
                Para amigos, família
                <br />e todo mundo junto.
              </span>
            </div>
          </div>
          <div
            className="hero-art"
            aria-label="Ilustração de um presente natalino"
          >
            <div className="holiday-seal">
              UM POUCO DE
              <br />
              <strong>MAGIA</strong>
              <br />
              EM CADA ENCONTRO
            </div>
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="art-spark s1">✳</div>
            <div className="art-spark s2">✦</div>
            <div className="art-label">
              UMA BOA SURPRESA
              <br />
              <strong>ESTÁ A CAMINHO</strong>
            </div>
            <div className="gift-shadow" />
            <div className="gift-glow" aria-hidden="true" />
            <div className="gift-surprise" aria-hidden="true">
              ✦
            </div>
            <div className="gift-box">
              <div className="ribbon-v" />
              <div className="gift-lid">
                <div className="ribbon-top" />
              </div>
              <div className="bow bow-left" />
              <div className="bow bow-right" />
              <div className="bow-knot" />
              <div className="gift-tag">
                feito com
                <br />
                <strong>carinho</strong> ♥
              </div>
            </div>
            <div className="art-bottom">
              GUARDE ESSE SEGREDO <span>✳</span> ESPALHE ALEGRIA
            </div>
          </div>
        </section>
        <div className="marquee">
          <div>
            BOAS PESSOAS <span>✳</span> BOAS SURPRESAS <span>✳</span> BONS
            MOMENTOS <span>✳</span> BOAS PESSOAS <span>✳</span> BOAS SURPRESAS{" "}
            <span>✳</span>
          </div>
        </div>
        <section id="como" className="section light">
          <div className="wrap">
            <div className="section-head">
              <div>
                <div className="kicker">
                  UM NATAL MAIS LEVE, DO INÍCIO AO FIM
                </div>
                <h2>
                  A magia acontece assim<span className="pink">.</span>
                </h2>
              </div>
              <p>
                Um convite, um sorteio e um montão
                <br />
                de motivos para sorrir.
              </p>
            </div>
            <div
              className="steps"
              onPointerMove={(e) => {
                const card = (e.target as HTMLElement).closest("article");
                if (!card) return;
                const r = card.getBoundingClientRect();
                card.style.setProperty("--mx", `${e.clientX - r.left}px`);
                card.style.setProperty("--my", `${e.clientY - r.top}px`);
              }}
            >
              <article>
                <div className="step-icon">
                  <Users />
                </div>
                <div className="step-num">01 / O COMEÇO</div>
                <h3>Reúna a turma</h3>
                <p>
                  Crie seu grupo, compartilhe o convite e veja todo mundo
                  chegar.
                </p>
              </article>
              <article>
                <div className="step-icon blue">
                  <CalendarDays />
                </div>
                <div className="step-num">02 / A MÁGICA</div>
                <h3>Escolha o momento</h3>
                <p>
                  Sorteie na hora ou agende. A gente cuida dos pares e das
                  regras.
                </p>
              </article>
              <article>
                <div className="step-icon pink-bg">
                  <Gift />
                </div>
                <div className="step-num">03 / A SURPRESA</div>
                <h3>Descubra seu par</h3>
                <p>
                  Cada pessoa vê só o seu resultado. O segredo continua seguro.
                </p>
              </article>
            </div>
          </div>
        </section>
        <section className="frost-section light">
          <div className="wrap frost-layout">
            <div className="frost-copy">
              <div className="kicker">É SOBRE ESTAR PRESENTE</div>
              <h2>
                Os melhores presentes <em>aproximam.</em>
              </h2>
              <p>
                Um encontro, uma surpresa e mais uma história para guardar.
                Celebre do seu jeito, com quem faz parte dele.
              </p>
            </div>
            <FrostedCard
              imageUrl="https://images.unsplash.com/photo-1512389142860-9c449e58a543?auto=format&fit=crop&w=1100&q=80"
              alt="Luzes e enfeites de Natal"
              preTitle="UM NATAL PARA LEMBRAR"
              title="Juntos é melhor."
              date="feito com carinho"
            />
          </div>
        </section>
        <section className="experience-section">
          <div className="wrap experience-grid">
            <div className="experience-copy">
              <div className="kicker">ABRA COM CUIDADO ✦</div>
              <h2>
                O segredo é<br />
                <em>seu para revelar.</em>
              </h2>
              <p>
                Um momento de suspense só para você. Raspe o cartão e descubra
                quem vai receber seu carinho neste Natal.
              </p>
              <Link
                className="btn btn-navy"
                to={user ? "/app" : "/criar-conta"}
              >
                Quero participar
              </Link>
            </div>
            <div className="experience-preview">
              <div className="preview-note">
                UMA PEQUENA
                <br />
                <strong>GRANDE SURPRESA</strong>
              </div>
              <div className="preview-card preview-card-interactive">
                <ScratchCard name="Alguém especial" demo />
              </div>
              <div className="preview-spark">✳</div>
            </div>
          </div>
        </section>
        <section id="recursos" className="section features">
          <div className="wrap feature-grid">
            <div>
              <div className="kicker pale">
                PEQUENOS DETALHES, GRANDES MOMENTOS
              </div>
              <h2>
                A graça está
                <br />
                no <em>mistério.</em>
              </h2>
              <p className="feature-intro">
                Tudo o que seu grupo precisa para transformar uma troca de
                presentes em uma história para lembrar.
              </p>
              <Link
                className="btn btn-light"
                to={user ? "/app" : "/criar-conta"}
              >
                Começar agora
              </Link>
            </div>
            <div className="feature-list">
              <article>
                <span>
                  <MessageCircle />
                </span>
                <div>
                  <h3>Um chat. Nenhum spoiler.</h3>
                  <p>
                    Peça dicas e converse com quem você tirou sem revelar sua
                    identidade.
                  </p>
                </div>
              </article>
              <article>
                <span>
                  <Gift />
                </span>
                <div>
                  <h3>Presentes com intenção.</h3>
                  <p>
                    Crie uma lista de desejos e deixe pistas para quem vai
                    presentear você.
                  </p>
                </div>
              </article>
              <article>
                <span>
                  <LockKeyhole />
                </span>
                <div>
                  <h3>Seu segredo é seu.</h3>
                  <p>
                    O resultado é individual. Até quem organiza entra na
                    brincadeira.
                  </p>
                </div>
              </article>
            </div>
          </div>
        </section>
        <section id="duvidas" className="section light">
          <div className="wrap faq-grid">
            <div>
              <div className="kicker">ANTES DE COMEÇAR</div>
              <h2>
                Alguma
                <br />
                dúvida<span className="pink">?</span>
              </h2>
              <p>
                As respostas para você entrar na brincadeira com tranquilidade.
              </p>
            </div>
            <div className="faq">
              {[
                [
                  "O organizador consegue ver todos os resultados?",
                  "Não. Cada pessoa acessa apenas o próprio resultado, inclusive quem criou o grupo.",
                ],
                [
                  "Posso agendar o sorteio?",
                  "Sim. Escolha a data e o horário e a plataforma fará o sorteio automaticamente. A execução pode levar alguns minutos.",
                ],
                [
                  "Pessoas da mesma família podem evitar tirar umas às outras?",
                  "Sim. O organizador pode indicar a mesma família para essas pessoas antes do sorteio.",
                ],
                [
                  "Como recebo meu resultado?",
                  "Entre na plataforma com sua conta e abra o grupo. O resultado aparece somente para você.",
                ],
                [
                  "Preciso pagar?",
                  "A proposta é tornar a organização simples e acessível. Não há pagamento nesta versão.",
                ],
              ].map(([q, a]) => (
                <details key={q}>
                  <summary>
                    {q}
                    <Plus size={19} />
                  </summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
        <section className="cta wrap">
          <div>
            <div className="kicker pale">O PRÓXIMO MOMENTO É SEU</div>
            <h2>
              Vamos criar uma
              <br />
              <em>boa surpresa?</em>
            </h2>
            <p>As melhores histórias começam com pessoas reunidas.</p>
            <Link className="btn btn-light" to={user ? "/app" : "/criar-conta"}>
              Criar meu grupo
            </Link>
          </div>
          <div className="cta-star">✳</div>
        </section>
      </main>
      <footer className="footer wrap">
        <Brand />
        <p>Feito para aproximar pessoas. Mesmo de longe.</p>
        <a href="#como">Voltar ao início ↑</a>
      </footer>
    </div>
  );
}
