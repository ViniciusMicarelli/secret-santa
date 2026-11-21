import { useEffect, useState, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { api } from "../shared/api/client";
import type { User } from "../shared/types";
import { Landing } from "../pages/landing/Landing";
import { Auth } from "../pages/auth/Auth";
import { Recovery } from "../pages/auth/Recovery";
import { Security } from "../pages/auth/Security";
import { Dashboard } from "../pages/dashboard/Dashboard";
import { GroupPage } from "../pages/group/GroupPage";
import { Join } from "../pages/group/Join";
import { safeDestination } from "./navigation";

function Protected({
  user,
  children,
}: {
  user: User | null;
  children: ReactNode;
}) {
  const loc = useLocation();
  return user ? (
    <>{children}</>
  ) : (
    <Navigate
      to={"/login?voltar=" + encodeURIComponent(loc.pathname)}
      replace
    />
  );
}
export function App() {
  const loc = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    api("/me")
      .then(setUser)
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);
  if (!ready)
    return (
      <div className="loading">
        entre nós<span>.</span>
      </div>
    );
  return (
    <Routes>
      <Route path="/" element={<Landing user={user} />} />
      <Route
        path="/login"
        element={
          user ? (
            <Navigate
              to={safeDestination(
                new URLSearchParams(loc.search).get("voltar"),
              )}
              replace
            />
          ) : (
            <Auth setUser={setUser} />
          )
        }
      />
      <Route
        path="/entrar"
        element={<Navigate to={"/login" + loc.search} replace />}
      />
      <Route path="/recuperar" element={<Recovery />} />
      <Route
        path="/seguranca"
        element={
          <Protected user={user}>
            <Security />
          </Protected>
        }
      />
      <Route
        path="/criar-conta"
        element={
          user ? (
            <Navigate
              to={safeDestination(
                new URLSearchParams(loc.search).get("voltar"),
              )}
              replace
            />
          ) : (
            <Auth register setUser={setUser} />
          )
        }
      />
      <Route
        path="/app"
        element={
          <Protected user={user}>{user && <Dashboard user={user} />}</Protected>
        }
      />
      <Route
        path="/grupo/:id"
        element={
          <Protected user={user}>{user && <GroupPage user={user} />}</Protected>
        }
      />
      <Route
        path="/convite/:code"
        element={
          <Protected user={user}>
            <Join />
          </Protected>
        }
      />
      <Route path="*" element={<Landing user={user} />} />
    </Routes>
  );
}
