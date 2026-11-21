import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Sparkles,
} from "lucide-react";

const papers = [
  { x: 15, bottom: 21, r: -16, green: false },
  { x: 30, bottom: 14, r: 12, green: true },
  { x: 44, bottom: 24, r: -9, green: false },
  { x: 58, bottom: 12, r: 14, green: true },
  { x: 72, bottom: 25, r: -14, green: false },
  { x: 85, bottom: 14, r: 10, green: true },
];
export function GiftJar({ name }: { name: string }) {
  const [position, setPosition] = useState(2);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const animating = useRef(false);
  useEffect(
    () => () => {
      timeline.current?.kill();
    },
    [],
  );
  function move(direction: number) {
    if (!animating.current && !revealed)
      setPosition((current) =>
        Math.max(0, Math.min(papers.length - 1, current + direction)),
      );
  }
  function grab() {
    if (animating.current || revealed) return;
    animating.current = true;
    setBusy(true);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRevealed(true);
      setBusy(false);
      animating.current = false;
      return;
    }
    const head = root.current?.querySelector(".claw-head"),
      cable = root.current?.querySelector(".claw-cable"),
      picked = root.current?.querySelector(".claw-prize"),
      paper = root.current?.querySelector(`[data-paper="${position}"]`);
    if (!head || !cable || !picked || !paper) {
      setRevealed(true);
      setBusy(false);
      animating.current = false;
      return;
    }
    timeline.current = gsap.timeline({
      onComplete: () => {
        setRevealed(true);
        setBusy(false);
        animating.current = false;
      },
    });
    timeline.current
      .to(head, { y: 145, duration: 1.25, ease: "power1.inOut" }, 0)
      .to(cable, { height: 157, duration: 1.25, ease: "power1.inOut" }, 0)
      .to(head, { rotation: -4, duration: 0.18, yoyo: true, repeat: 1 })
      .set(paper, { opacity: 0 })
      .set(picked, { opacity: 1 })
      .to(head, { y: 0, rotation: 0, duration: 1.1, ease: "power1.inOut" })
      .to(cable, { height: 12, duration: 1.1, ease: "power1.inOut" }, "<")
      .to(picked, { scale: 1.3, duration: 0.35, ease: "back.out(1.7)" });
  }
  function reset() {
    timeline.current?.kill();
    animating.current = false;
    setRevealed(false);
    setBusy(false);
    setPosition(2);
  }
  return (
    <section
      className="gift-jar-panel"
      ref={root}
      aria-labelledby="gift-jar-title"
    >
      <div className="jar-intro">
        <div className="kicker">
          UM SEGREDO SÓ SEU <Sparkles size={13} aria-hidden="true" />
        </div>
        <h2 id="gift-jar-title">
          Sua surpresa <em>está na garra.</em>
        </h2>
        <p>
          Posicione a garra e pegue um envelope para descobrir quem você vai
          presentear.
        </p>
      </div>
      {!revealed ? (
        <div
          className="claw-game"
          tabIndex={0}
          aria-label="Máquina de presentes. Use as setas esquerda e direita para mover a garra e a seta para baixo para pegar um envelope."
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              move(-1);
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              move(1);
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              grab();
            }
          }}
        >
          <div className="claw-machine" aria-hidden="true">
            <div className="machine-top">
              <span>✦</span> ENTRE NÓS <span>✦</span>
            </div>
            <div className="machine-window">
              <div className="machine-stars">
                ✧ <span>✦</span> ✧
              </div>
              <div className="machine-rail" />
              <div
                className="claw-assembly"
                style={{ left: `${papers[position].x}%` }}
              >
                <div className="claw-cable" />
                <div className="claw-head">
                  <div className="claw-joint" />
                  <svg
                    viewBox="0 0 64 60"
                    className="claw-svg"
                    aria-hidden="true"
                  >
                    <path d="M25 7 C12 11 11 25 14 37 L21 48 L25 43 L21 34 C19 23 22 17 28 15" />
                    <path d="M39 7 C52 11 53 25 50 37 L43 48 L39 43 L43 34 C45 23 42 17 36 15" />
                    <circle cx="32" cy="10" r="9" />
                  </svg>
                  <div
                    className={`claw-prize ${papers[position].green ? "envelope-green" : "envelope-red"}`}
                  >
                    <span>✦</span>
                  </div>
                </div>
              </div>
              <div className="machine-bed">
                {papers.map((paper, index) => (
                  <div
                    key={index}
                    data-paper={index}
                    className={`machine-envelope ${paper.green ? "envelope-green" : "envelope-red"}`}
                    style={{
                      left: `${paper.x}%`,
                      bottom: paper.bottom,
                      transform: `translateX(-50%) rotate(${paper.r}deg)`,
                    }}
                  >
                    <span>✦</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="machine-base">
              <span>✳</span>
              <i />
              <span>✳</span>
            </div>
          </div>
          <p className="machine-instruction">
            MOVA A GARRA E ESCOLHA SEU ENVELOPE
          </p>
          <div className="machine-controls" aria-label="Controles da garra">
            <button
              type="button"
              onClick={() => move(-1)}
              disabled={busy || position === 0}
              aria-label="Mover garra para a esquerda"
            >
              <ArrowLeft size={21} />
            </button>
            <button
              type="button"
              className="machine-grab"
              onClick={grab}
              disabled={busy}
            >
              <ArrowDown size={18} /> {busy ? "Pegando..." : "Pegar"}
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              disabled={busy || position === papers.length - 1}
              aria-label="Mover garra para a direita"
            >
              <ArrowRight size={21} />
            </button>
          </div>
          <span className="sr-only" aria-live="polite">
            {busy
              ? "A garra está pegando seu envelope."
              : `Garra na posição ${position + 1} de ${papers.length}.`}
          </span>
        </div>
      ) : (
        <div className="jar-reveal" role="status" aria-live="polite">
          <span className="reveal-envelope" aria-hidden="true">
            <span className="reveal-envelope-flap" />
            <span className="reveal-envelope-letter">✦</span>
          </span>
          <span className="jar-reveal-label">VOCÊ VAI PRESENTEAR</span>
          <strong>{name}</strong>
          <p>Agora é só preparar uma surpresa cheia de carinho.</p>
          <button type="button" className="jar-reset" onClick={reset}>
            <RotateCcw size={15} /> Guardar o segredo
          </button>
        </div>
      )}
      <p className="jar-footnote">
        A brincadeira revela seu resultado já sorteado. A posição da garra não
        altera seu amigo secreto.
      </p>
    </section>
  );
}
