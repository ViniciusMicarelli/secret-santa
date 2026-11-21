import { useEffect, useRef, useState, type CSSProperties } from "react";
import gsap from "gsap";
import { Hand, RotateCcw, Sparkles } from "lucide-react";

// Decorative envelopes are independent of the number of people in the group.
const envelopes = Array.from({ length: 24 }, (_, index) => {
  const row = Math.floor(index / 6);
  const column = index % 6;
  return {
    x: 14 + column * 14.4 + (((index * 7) % 5) - 2),
    y: 28 + row * 16 + (((index * 11) % 7) - 3),
    rotation: ((index * 23) % 43) - 21,
    green: (index + row) % 2 === 0,
  };
});

export function GiftJar({ name }: { name: string }) {
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLElement>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const animating = useRef(false);
  useEffect(
    () => () => {
      timeline.current?.kill();
    },
    [],
  );

  function choose(index: number) {
    if (animating.current || revealed) return;
    animating.current = true;
    setBusy(true);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRevealed(true);
      setBusy(false);
      animating.current = false;
      return;
    }
    const bowl = root.current?.querySelector<HTMLElement>(".bowl-glass");
    const chosen = root.current?.querySelector<HTMLElement>(
      `[data-envelope="${index}"]`,
    );
    if (!bowl || !chosen) {
      setRevealed(true);
      setBusy(false);
      animating.current = false;
      return;
    }
    const bounds = bowl.getBoundingClientRect();
    const item = chosen.getBoundingClientRect();
    const dx = bounds.left + bounds.width / 2 - (item.left + item.width / 2);
    const dy = bounds.top + bounds.height * 0.26 - (item.top + item.height / 2);
    timeline.current = gsap.timeline({
      onComplete: () => {
        setRevealed(true);
        setBusy(false);
        animating.current = false;
      },
    });
    timeline.current
      .set(chosen, { zIndex: 10 })
      .to(chosen, {
        x: dx,
        y: dy,
        rotation: 0,
        scale: 1.7,
        duration: 0.9,
        ease: "power3.inOut",
      })
      .to(
        chosen,
        { scale: 1.9, opacity: 0, duration: 0.35, ease: "power1.in" },
        "+=.15",
      );
  }
  function reset() {
    timeline.current?.kill();
    animating.current = false;
    setRevealed(false);
    setBusy(false);
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
          Um pequeno papel, <em>uma grande surpresa.</em>
        </h2>
        <p>
          Explore os envelopes e escolha aquele que vai revelar seu amigo
          secreto.
        </p>
      </div>
      {!revealed ? (
        <div className="bowl-game">
          <div className="bowl-rim" aria-hidden="true" />
          <div className="bowl-glass">
            <div className="bowl-shine" aria-hidden="true" />
            <div className="bowl-stars" aria-hidden="true">
              ✦ <span>✧</span> ✦
            </div>
            {envelopes.map((envelope, index) => (
              <button
                key={index}
                type="button"
                data-envelope={index}
                disabled={busy}
                onClick={() => choose(index)}
                className={`bowl-envelope ${envelope.green ? "bowl-envelope-green" : "bowl-envelope-red"}`}
                aria-label={`Escolher envelope ${index + 1}`}
                style={
                  {
                    "--x": `${envelope.x}%`,
                    "--y": `${envelope.y}%`,
                    "--rotate": `${envelope.rotation}deg`,
                  } as CSSProperties
                }
              >
                <span className="envelope-face" aria-hidden="true">
                  <i>✦</i>
                </span>
              </button>
            ))}
          </div>
          <div className="bowl-shadow" aria-hidden="true" />
          <p className="bowl-hint">
            <Hand size={16} aria-hidden="true" />
            <span className="bowl-hint-pointer">
              Passe o mouse e clique em um envelope
            </span>
            <span className="bowl-hint-touch">
              Toque em um envelope para escolher
            </span>
          </p>
          <span className="sr-only" aria-live="polite">
            {busy
              ? "Abrindo seu envelope..."
              : "Escolha um dos 24 envelopes para revelar seu resultado."}
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
        Os envelopes são uma brincadeira: seu amigo secreto já foi sorteado e
        não muda com a escolha.
      </p>
    </section>
  );
}
