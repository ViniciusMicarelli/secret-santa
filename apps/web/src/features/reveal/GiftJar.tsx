import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import gsap from "gsap";
import { Hand, RotateCcw, Sparkles } from "lucide-react";

// Decorative envelopes are independent of the number of people in the group.
const envelopes = Array.from({ length: 48 }, (_, index) => ({
  x: 0.21 + (index % 8) * 0.083 + (((index * 7) % 5) - 2) * 0.006,
  y: 0.47 + Math.floor(index / 8) * 0.076 + (((index * 11) % 5) - 2) * 0.004,
  rotation: ((index * 23) % 55) - 27,
  green: (index + Math.floor(index / 8)) % 2 === 0,
}));
type Particle = {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  rotation: number;
};

export function GiftJar({ name }: { name: string }) {
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLElement>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const animating = useRef(false);
  const particles = useRef<Particle[]>(
    envelopes.map((p) => ({ ...p, targetX: p.x, targetY: p.y })),
  );
  const gesture = useRef<{
    x: number;
    y: number;
    index: number | null;
    lastX: number;
    lastY: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const reduced = useRef(false);
  const mouseHeld = useRef(false);
  useEffect(() => {
    if (revealed) return;
    reduced.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced.current) return;
    let frame = 0;
    function tick() {
      if (!animating.current && !mouseHeld.current) {
        const items = particles.current;
        root.current
          ?.querySelectorAll<HTMLElement>(".bowl-envelope")
          .forEach((element, i) => {
            const p = items[i];
            const dx = p.targetX - p.x,
              dy = p.targetY - p.y;
            if (Math.abs(dx) + Math.abs(dy) > 0.00005) {
              p.x += dx * 0.075;
              p.y += dy * 0.075;
              element.style.setProperty("--x", `${p.x * 100}%`);
              element.style.setProperty("--y", `${p.y * 100}%`);
            }
          });
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [revealed]);
  function stir(
    event: ReactPointerEvent<HTMLDivElement>,
    deltaX: number,
    deltaY: number,
  ) {
    if (animating.current || reduced.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width,
      y = (event.clientY - rect.top) / rect.height;
    const dx = Math.max(-0.003, Math.min(0.003, (deltaX / rect.width) * 0.12));
    const dy = Math.max(-0.002, Math.min(0.002, (deltaY / rect.height) * 0.08));
    for (const p of particles.current) {
      const distance = Math.hypot(p.x - x, (p.y - y) * 0.8);
      if (distance < 0.15) {
        const strength = 1 - distance / 0.15;
        p.targetX = Math.max(0.18, Math.min(0.82, p.targetX + dx * strength));
        p.targetY = Math.max(0.43, Math.min(0.86, p.targetY + dy * strength));
      }
    }
  }
  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse") {
      mouseHeld.current = true;
      return;
    }
    const button = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-envelope]",
    );
    gesture.current = {
      x: event.clientX,
      y: event.clientY,
      index: button ? Number(button.dataset.envelope) : null,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (
      gesture.current &&
      Math.hypot(
        event.clientX - gesture.current.x,
        event.clientY - gesture.current.y,
      ) > 8
    )
      gesture.current.moved = true;
    if (event.pointerType === "mouse" && !mouseHeld.current)
      stir(event, event.movementX, event.movementY);
    else if (gesture.current) {
      const dx = event.clientX - gesture.current.lastX,
        dy = event.clientY - gesture.current.lastY;
      gesture.current.lastX = event.clientX;
      gesture.current.lastY = event.clientY;
      if (gesture.current.moved) stir(event, dx, dy);
    }
  }
  function pointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    mouseHeld.current = false;
    const current = gesture.current;
    if (!current) return;
    gesture.current = null;
    suppressClick.current = true;
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 500);
    if (!current.moved && current.index !== null) choose(current.index);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }
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
          <div
            className="bowl-glass"
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerLeave={(event) => {
              if (event.pointerType === "mouse") mouseHeld.current = false;
            }}
            onPointerUp={pointerUp}
            onPointerCancel={() => {
              gesture.current = null;
              mouseHeld.current = false;
            }}
          >
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
                onClick={() => {
                  if (!suppressClick.current) choose(index);
                }}
                className={`bowl-envelope ${envelope.green ? "bowl-envelope-green" : "bowl-envelope-red"}`}
                aria-label={`Escolher envelope ${index + 1}`}
                style={
                  {
                    "--x": `${envelope.x * 100}%`,
                    "--y": `${envelope.y * 100}%`,
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
              Passe a mão para misturar; clique para escolher
            </span>
            <span className="bowl-hint-touch">
              Arraste para misturar; toque para escolher
            </span>
          </p>
          <span className="sr-only" aria-live="polite">
            {busy
              ? "Abrindo seu envelope..."
              : "Escolha um dos envelopes para revelar seu resultado."}
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
