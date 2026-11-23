import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import gsap from "gsap";
import { Hand, RotateCcw, Shuffle, Sparkles } from "lucide-react";

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

export function GiftJar({
  name,
  demo = false,
}: {
  name: string;
  demo?: boolean;
}) {
  const bowlEnvelopes = useRef(envelopes.slice(demo ? 24 : 0)).current;
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shuffling, setShuffling] = useState(false);
  const root = useRef<HTMLElement>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const animating = useRef(false);
  const particles = useRef<Particle[]>(
    bowlEnvelopes.map((p) => ({ ...p, targetX: p.x, targetY: p.y })),
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
    let visible = false;
    function start() {
      if (visible && !document.hidden && !frame)
        frame = requestAnimationFrame(tick);
    }
    function tick() {
      frame = 0;
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
      start();
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    });
    if (root.current) observer.observe(root.current);
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else start();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      cancelAnimationFrame(frame);
    };
  }, [revealed]);
  function stir(
    event: ReactPointerEvent<HTMLDivElement>,
    deltaX: number,
    deltaY: number,
  ) {
    if (animating.current || shuffling || reduced.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width,
      y = (event.clientY - rect.top) / rect.height;
    const touch = event.pointerType !== "mouse";
    const limitX = touch ? 0.009 : 0.003;
    const limitY = touch ? 0.006 : 0.002;
    const dx = Math.max(
      -limitX,
      Math.min(limitX, (deltaX / rect.width) * (touch ? 0.32 : 0.12)),
    );
    const dy = Math.max(
      -limitY,
      Math.min(limitY, (deltaY / rect.height) * (touch ? 0.24 : 0.08)),
    );
    const radius = touch ? 0.21 : 0.15;
    for (const p of particles.current) {
      const distance = Math.hypot(p.x - x, (p.y - y) * 0.8);
      if (distance < radius) {
        const strength = 1 - distance / radius;
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

  function shuffle() {
    if (busy || animating.current) return;
    const destinations = bowlEnvelopes.map(({ x, y }) => ({ x, y }));
    for (let i = destinations.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [destinations[i], destinations[j]] = [destinations[j], destinations[i]];
    }
    const instant = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const elements =
      root.current?.querySelectorAll<HTMLElement>(".bowl-envelope");
    if (!elements || elements.length !== particles.current.length) return;
    const render = (particle: Particle, index: number) => {
      const element = elements[index];
      element.style.setProperty("--x", `${particle.x * 100}%`);
      element.style.setProperty("--y", `${particle.y * 100}%`);
      element.style.setProperty("--rotate", `${particle.rotation}deg`);
    };
    if (instant) {
      particles.current.forEach((particle, index) => {
        particle.x = particle.targetX = destinations[index].x;
        particle.y = particle.targetY = destinations[index].y;
        render(particle, index);
      });
      return;
    }
    animating.current = true;
    setBusy(true);
    setShuffling(true);
    timeline.current = gsap.timeline({
      onComplete: () => {
        particles.current.forEach((particle) => {
          particle.targetX = particle.x;
          particle.targetY = particle.y;
        });
        animating.current = false;
        setBusy(false);
        setShuffling(false);
      },
    });
    particles.current.forEach((particle, index) => {
      const delay = (index % 8) * 0.035;
      const destination = destinations[index];
      const crossingX = Math.max(
        0.2,
        Math.min(0.8, 1 - particle.x + ((index % 3) - 1) * 0.035),
      );
      const crossingY = Math.max(0.35, particle.y - 0.1 - (index % 4) * 0.015);
      timeline
        .current!.to(
          particle,
          {
            x: crossingX,
            y: crossingY,
            rotation: bowlEnvelopes[index].rotation + (index % 2 ? 12 : -12),
            duration: 0.85,
            ease: "sine.inOut",
            onUpdate: () => render(particle, index),
          },
          delay,
        )
        .to(
          particle,
          {
            x: destination.x,
            y: destination.y,
            rotation: bowlEnvelopes[index].rotation,
            duration: 0.95,
            ease: "sine.inOut",
            onUpdate: () => render(particle, index),
          },
          0.85 + delay,
        );
    });
  }
  function choose(index: number) {
    if (busy || animating.current || revealed) return;
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
      className={demo ? "gift-jar-panel gift-jar-demo" : "gift-jar-panel"}
      ref={root}
      aria-labelledby="gift-jar-title"
    >
      <div className="jar-intro">
        <div className="kicker">
          {demo ? "UMA PRÉVIA PARA VOCÊ" : "UM SEGREDO SÓ SEU"}{" "}
          <Sparkles size={13} aria-hidden="true" />
        </div>
        <h2 id="gift-jar-title">
          Um pequeno papel, <em>uma grande surpresa.</em>
        </h2>
        <p>
          {demo
            ? "Escolha um envelope e experimente a revelação."
            : "Explore os envelopes e escolha aquele que vai revelar seu amigo secreto."}
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
              <Sparkles size={17} />
              <Sparkles size={12} />
              <Sparkles size={17} />
            </div>
            {bowlEnvelopes.map((envelope, index) => (
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
                    "--x": `${particles.current[index].x * 100}%`,
                    "--y": `${particles.current[index].y * 100}%`,
                    "--rotate": `${envelope.rotation}deg`,
                  } as CSSProperties
                }
              >
                <span className="envelope-face" aria-hidden="true">
                  <i>
                    <Sparkles size={10} />
                  </i>
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
          <button
            type="button"
            className="bowl-shuffle"
            onClick={shuffle}
            disabled={busy}
          >
            <Shuffle size={16} aria-hidden="true" />{" "}
            {shuffling ? "Embaralhando..." : "Embaralhar envelopes"}
          </button>
          <span className="sr-only" aria-live="polite">
            {shuffling
              ? "Embaralhando os envelopes."
              : busy
                ? "Abrindo seu envelope..."
                : "Escolha um dos envelopes para revelar seu resultado."}
          </span>
        </div>
      ) : (
        <div className="jar-reveal" role="status" aria-live="polite">
          <span className="reveal-envelope" aria-hidden="true">
            <span className="reveal-envelope-flap" />
            <span className="reveal-envelope-letter">
              <Sparkles size={16} />
            </span>
          </span>
          <span className="jar-reveal-label">
            {demo ? "EXEMPLO DE RESULTADO" : "VOCÊ VAI PRESENTEAR"}
          </span>
          <strong>{name}</strong>
          <p>Agora é só preparar uma surpresa cheia de carinho.</p>
          <button type="button" className="jar-reset" onClick={reset}>
            <RotateCcw size={15} /> Guardar o segredo
          </button>
        </div>
      )}
      <p className="jar-footnote">
        {demo
          ? "Esta é uma demonstração. No seu grupo, somente você verá seu resultado."
          : "Os envelopes são uma brincadeira: seu amigo secreto já foi sorteado e não muda com a escolha."}
      </p>
    </section>
  );
}
