import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Gift, RotateCcw, Sparkles } from "lucide-react";

const papers = [
  { x: 18, y: 63, r: -24, green: false },
  { x: 43, y: 72, r: 16, green: true },
  { x: 69, y: 64, r: -13, green: false },
  { x: 24, y: 39, r: 17, green: true },
  { x: 53, y: 46, r: -20, green: false },
  { x: 76, y: 37, r: 18, green: true },
  { x: 36, y: 19, r: -10, green: false },
  { x: 63, y: 22, r: 20, green: true },
];

type Props = { name: string };
export function GiftJar({ name }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  useEffect(
    () => () => {
      timeline.current?.kill();
    },
    [],
  );

  function choose(index: number) {
    if (busy || selected !== null) return;
    setBusy(true);
    setSelected(index);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRevealed(true);
      setBusy(false);
      return;
    }
    const chosen = root.current?.querySelector(`[data-paper="${index}"]`);
    timeline.current = gsap.timeline({
      onComplete: () => {
        setRevealed(true);
        setBusy(false);
      },
    });
    timeline.current
      .to(chosen ?? null, {
        y: -95,
        rotation: 12,
        scale: 1.3,
        duration: 0.8,
        ease: "back.inOut(1.2)",
      })
      .to(chosen ?? null, {
        scale: 0.4,
        opacity: 0,
        duration: 0.35,
        ease: "power2.in",
      });
  }
  function reset() {
    timeline.current?.kill();
    setRevealed(false);
    setSelected(null);
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
          A magia está <em>nas suas mãos.</em>
        </h2>
        <p>
          Escolha um papelzinho no pote para descobrir quem você vai presentear.
        </p>
      </div>
      {!revealed ? (
        <div className="jar-scene">
          <div className="jar-spark jar-spark-one" aria-hidden="true">
            ✧
          </div>
          <div className="jar-spark jar-spark-two" aria-hidden="true">
            ✳
          </div>
          <div className="jar-lid" aria-hidden="true">
            <span />
          </div>
          <div className="jar-glass">
            <div className="jar-reflection" aria-hidden="true" />
            <div
              className="jar-papers"
              aria-label="Escolha um papel para revelar seu amigo secreto"
            >
              {papers.map((paper, index) => (
                <button
                  key={index}
                  type="button"
                  data-paper={index}
                  aria-label={`Escolher papel ${index + 1}`}
                  disabled={busy}
                  onClick={() => choose(index)}
                  className={`jar-paper ${paper.green ? "jar-paper-green" : "jar-paper-red"}`}
                  style={{
                    left: `${paper.x}%`,
                    top: `${paper.y}%`,
                    transform: `translate(-50%, -50%) rotate(${paper.r}deg)`,
                  }}
                >
                  <span aria-hidden="true">✦</span>
                </button>
              ))}
            </div>
          </div>
          <div className="jar-base" aria-hidden="true" />
          <p className="jar-hint">✦ &nbsp; ESCOLHA UM PAPELZINHO &nbsp; ✦</p>
        </div>
      ) : (
        <div className="jar-reveal" role="status" aria-live="polite">
          <span className="jar-reveal-icon">
            <Gift size={26} aria-hidden="true" />
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
        O resultado já foi sorteado. A escolha do papel é uma brincadeira e não
        altera seu amigo secreto.
      </p>
    </section>
  );
}
