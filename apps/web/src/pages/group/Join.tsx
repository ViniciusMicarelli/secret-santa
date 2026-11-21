import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../shared/api/client";
import { Shell } from "../../shared/ui/Shell";

export function Join() {
  const { code } = useParams();
  const nav = useNavigate();
  const [err, SE] = useState("");
  useEffect(() => {
    api("/join/" + code, "POST", {})
      .then((g) => nav("/grupo/" + g.id, { replace: true }))
      .catch((e) => SE(e.message));
  }, [code, nav]);
  return (
    <Shell>
      <div className="wrap app-content">
        <h1>{err || "Entrando no grupo..."}</h1>
        <Link to="/app">Ir para meus grupos</Link>
      </div>
    </Shell>
  );
}
