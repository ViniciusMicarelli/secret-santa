import { useEffect, useState } from "react";
import { BrandMark } from "../../shared/ui/BrandMark";

/** A short, non-blocking introduction shown once per browser tab. */
export function Intro() {
  const [visible, setVisible] = useState(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return false;
    try {
      return sessionStorage.getItem("entre-nos-intro") !== "seen";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    if (!visible) return;
    try {
      sessionStorage.setItem("entre-nos-intro", "seen");
    } catch {
      /* Storage is optional. */
    }
    const timer = window.setTimeout(() => setVisible(false), 2000);
    return () => window.clearTimeout(timer);
  }, [visible]);
  if (!visible) return null;
  return (
    <div className="intro" aria-hidden="true">
      <div className="intro-mark">
        <BrandMark />
      </div>
      <div className="intro-name">
        entre nós<span>.</span>
      </div>
      <div className="intro-caption">UM ENCONTRO PARA LEMBRAR</div>
      <div className="intro-line" />
    </div>
  );
}
