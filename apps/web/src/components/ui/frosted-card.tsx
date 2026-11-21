import {
  forwardRef,
  useState,
  type HTMLAttributes,
  type MouseEvent,
} from "react";

export interface FrostedCardProps extends HTMLAttributes<HTMLDivElement> {
  imageUrl: string;
  title: string;
  preTitle?: string;
  date?: string;
  alt: string;
}

/** A quiet, dimensional image card; motion follows the visitor's preferences. */
export const FrostedCard = forwardRef<HTMLDivElement, FrostedCardProps>(
  ({ className = "", imageUrl, title, preTitle, date, alt, ...props }, ref) => {
    const [rotation, setRotation] = useState({ x: 0, y: 0 });
    function move(event: MouseEvent<HTMLDivElement>) {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const rect = event.currentTarget.getBoundingClientRect();
      setRotation({
        x: (-(event.clientY - rect.top - rect.height / 2) / rect.height) * 8,
        y: ((event.clientX - rect.left - rect.width / 2) / rect.width) * 8,
      });
    }
    return (
      <div
        ref={ref}
        {...props}
        className={`frosted-card ${className}`}
        onMouseMove={move}
        onMouseLeave={() => setRotation({ x: 0, y: 0 })}
      >
        <div
          className="frosted-card-inner"
          style={{
            transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) scale(1.04)`,
          }}
        >
          <img src={imageUrl} alt={alt} loading="lazy" />
          <div className="frosted-card-content">
            {preTitle && <p>{preTitle}</p>}
            <h2>{title}</h2>
            {date && <span>{date}</span>}
          </div>
        </div>
      </div>
    );
  },
);
FrostedCard.displayName = "FrostedCard";
