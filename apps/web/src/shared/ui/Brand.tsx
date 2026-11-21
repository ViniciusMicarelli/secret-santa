import { Link } from "react-router-dom";
import { BrandMark } from "./BrandMark";

export function Brand() {
  return (
    <Link className="brand" to="/" aria-label="Entre Nós, início">
      <BrandMark />
      <span>
        entre nós<span className="brand-dot">.</span>
      </span>
    </Link>
  );
}
