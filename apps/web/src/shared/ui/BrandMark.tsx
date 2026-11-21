import { useEffect, useRef } from "react";
import gsap from "gsap";

/** The SVG remains readable without animation; GSAP adds a small ribbon flourish. */
export function BrandMark({ className = "" }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (
      !element ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const context = gsap.context(() => {
      gsap.from(".brand-bow", {
        scale: 0.7,
        opacity: 0,
        transformOrigin: "32px 25px",
        duration: 0.7,
        ease: "back.out(1.8)",
      });
      gsap.from(".brand-spark", {
        scale: 0,
        rotation: -45,
        transformOrigin: "48.5px 15.5px",
        duration: 0.55,
        delay: 0.25,
        ease: "back.out(2)",
      });
    }, element);
    const flourish = () =>
      gsap.fromTo(
        element.querySelector(".brand-spark"),
        { rotation: -25, scale: 0.7 },
        {
          rotation: 0,
          scale: 1,
          transformOrigin: "48.5px 15.5px",
          duration: 0.5,
          ease: "back.out(2)",
          overwrite: true,
        },
      );
    const parent = element.closest("a");
    parent?.addEventListener("pointerenter", flourish);
    parent?.addEventListener("focus", flourish);
    return () => {
      parent?.removeEventListener("pointerenter", flourish);
      parent?.removeEventListener("focus", flourish);
      context.revert();
    };
  }, []);
  return (
    <svg
      ref={ref}
      className={`brand-mark ${className}`}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="5" y="5" width="54" height="54" rx="18" fill="#dfc9a5" />
      <path
        d="M17 30h30v17a4 4 0 0 1-4 4H21a4 4 0 0 1-4-4V30Z"
        fill="#24483e"
      />
      <rect x="14" y="25" width="36" height="9" rx="3" fill="#24483e" />
      <path d="M29 25h6v26h-6z" fill="#dfc9a5" />
      <path
        className="brand-bow"
        d="M32 25c-3.3-6-10.9-8.7-12.3-4.8C18.4 24 24 26 32 25Zm0 0c3.3-6 10.9-8.7 12.3-4.8C45.6 24 40 26 32 25Z"
        stroke="#24483e"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        className="brand-spark"
        d="M48.5 12v7M45 15.5h7"
        stroke="#a14e59"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
