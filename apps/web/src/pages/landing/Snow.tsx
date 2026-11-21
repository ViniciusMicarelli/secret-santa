import type { CSSProperties } from "react";

export function Snow() {
  return (
    <div className="snow" aria-hidden="true">
      {Array.from({ length: 30 }, (_, i) => (
        <span
          key={i}
          style={
            {
              "--x": `${(i * 37) % 100}%`,
              "--delay": `${-(i * 1.37) % 16}s`,
              "--duration": `${10 + (i % 7) * 1.7}s`,
              "--size": `${3 + (i % 4) * 2}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
