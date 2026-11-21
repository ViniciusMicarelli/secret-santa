import { useEffect, useRef, useState } from "react";

type Props = { name: string; demo?: boolean };
export function ScratchCard({ name, demo = false }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    ctx.globalCompositeOperation = "source-over";
    const gradient = ctx.createLinearGradient(0, 0, 420, 180);
    gradient.addColorStop(0, "#ead7a3");
    gradient.addColorStop(0.45, "#b99757");
    gradient.addColorStop(1, "#f2e1b7");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 420, 180);
    ctx.fillStyle = "#513f27";
    ctx.font = "bold 17px Georgia";
    ctx.textAlign = "center";
    ctx.fillText("RASPE PARA DESCOBRIR", 210, 86);
    ctx.font = "13px sans-serif";
    ctx.fillText("uma surpresa espera por você", 210, 111);
  }, [revealed]);
  function scratch(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const rect = el.getBoundingClientRect();
    const point = {
      x: ((e.clientX - rect.left) * el.width) / rect.width,
      y: ((e.clientY - rect.top) * el.height) / rect.height,
    };
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineWidth = 38;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(last.current?.x ?? point.x, last.current?.y ?? point.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    last.current = point;
  }
  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    const pixels = ctx.getImageData(0, 0, 420, 180).data;
    let clear = 0;
    for (let i = 3; i < pixels.length; i += 16) if (pixels[i] < 128) clear++;
    if (clear / (pixels.length / 16) > 0.38) setRevealed(true);
  }
  return (
    <div className={demo ? "scratch-shell scratch-demo" : "scratch-shell"}>
      <div className="scratch-heading">
        {demo ? "UMA PRÉVIA PARA VOCÊ" : "UMA SURPRESA SÓ SUA"}
      </div>
      <h2>{demo ? "Experimente a surpresa." : "Seu segredo está aqui."}</h2>
      <p>
        {demo
          ? "Esta é uma demonstração. Raspe e veja como funciona."
          : "Raspe o cartão e descubra quem você vai presentear."}
      </p>
      <div className={revealed ? "scratch-card is-revealed" : "scratch-card"}>
        <div className="scratch-result" aria-hidden={!revealed}>
          <span>{demo ? "EXEMPLO DE RESULTADO" : "VOCÊ TIROU"}</span>
          <strong>{name}</strong>
          <small>Agora é hora de preparar uma surpresa</small>
        </div>
        {!revealed && (
          <canvas
            ref={canvas}
            width={420}
            height={180}
            aria-hidden="true"
            onPointerDown={(e) => {
              drawing.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              scratch(e);
            }}
            onPointerMove={scratch}
            onPointerUp={end}
            onPointerCancel={end}
          />
        )}
      </div>
      <div className="scratch-controls">
        {revealed ? (
          <button className="scratch-link" onClick={() => setRevealed(false)}>
            Esconder e raspar novamente
          </button>
        ) : (
          <button className="scratch-link" onClick={() => setRevealed(true)}>
            Revelar sem raspar
          </button>
        )}
      </div>
      <span className="sr-only" aria-live="polite">
        {revealed ? `${demo ? "Exemplo: " : "Você tirou "}${name}.` : ""}
      </span>
    </div>
  );
}
