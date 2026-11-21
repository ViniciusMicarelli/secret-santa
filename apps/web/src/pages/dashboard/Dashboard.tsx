import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight, Bell, LockKeyhole, Plus } from "lucide-react";
import { api } from "../../shared/api/client";
import { Shell } from "../../shared/ui/Shell";
import { notifyNewMessages } from "../../shared/notifications/browser";
import type { GroupSummary, User } from "../../shared/types";

export function Dashboard({ user }: { user: User }) {
  const [groups, SG] = useState<GroupSummary[]>([]),
    [open, SO] = useState(false),
    [name, SN] = useState(""),
    [description, SD] = useState(""),
    [eventDate, SE] = useState(""),
    [budget, SB] = useState(""),
    [err, SR] = useState("");
  const nav = useNavigate();
  const groupsRef = useRef<GroupSummary[]>([]);
  const [notificationPermission, setNotificationPermission] = useState(() =>
    "Notification" in window ? Notification.permission : "unsupported",
  );
  const groupIds = groups.map((g) => g.id).join(",");
  const refreshGroups = (notify = false) =>
    api("/groups")
      .then((next: GroupSummary[]) => {
        if (notify)
          for (const group of next) {
            const previous = groupsRef.current.find((g) => g.id === group.id);
            if (previous)
              notifyNewMessages(previous.unread, group.unread, group.name);
          }
        groupsRef.current = next;
        SG(next);
      })
      .catch((e) => SR(e.message));
  useEffect(() => {
    refreshGroups();
  }, []);
  useEffect(() => {
    if (!groupIds) return;
    let stopped = false;
    const sockets = new Map<number, WebSocket>();
    const timers: ReturnType<typeof setTimeout>[] = [];
    const connect = (id: number, attempt = 0) => {
      if (stopped) return;
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(
        `${protocol}//${location.host}/api/groups/${id}/events`,
      );
      sockets.set(id, ws);
      ws.onopen = () => {
        attempt = 0;
        refreshGroups();
      };
      ws.onmessage = (event) => {
        try {
          const update = JSON.parse(event.data);
          if (
            update.type === "chat" ||
            update.type === "group" ||
            update.type === "read"
          )
            refreshGroups(update.type === "chat");
        } catch {
          /* Ignore malformed events. */
        }
      };
      ws.onclose = () => {
        if (!stopped)
          timers.push(
            setTimeout(
              () => connect(id, attempt + 1),
              Math.min(1000 * 2 ** attempt, 30000) + Math.random() * 500,
            ),
          );
      };
      ws.onerror = () => ws.close();
    };
    for (const id of groupIds.split(",").map(Number)) connect(id);
    return () => {
      stopped = true;
      timers.forEach(clearTimeout);
      sockets.forEach((socket) => socket.close());
    };
  }, [groupIds]);
  async function create(e: FormEvent) {
    e.preventDefault();
    try {
      const g = await api("/groups", "POST", {
        name,
        description,
        eventDate,
        budget,
      });
      nav("/grupo/" + g.id);
    } catch (e) {
      SR((e as Error).message);
    }
  }
  return (
    <Shell>
      <main className="app-content wrap">
        <div className="dash-top">
          <div>
            <div className="kicker">SEU CANTINHO DE SURPRESAS</div>
            <h1>
              Olá, {user.name.split(" ")[0]}
              <span className="pink">.</span>
            </h1>
            <p>Que bom ter você por aqui. Vamos reunir a turma?</p>
          </div>
          <button className="btn btn-navy" onClick={() => SO(!open)}>
            <Plus size={18} /> Criar grupo
          </button>
        </div>
        <div className="security-reminder">
          <LockKeyhole size={20} />
          <span>
            <strong>Proteja seu acesso.</strong> Gere códigos de recuperação e
            guarde-os em um lugar seguro.
          </span>
          <Link to="/seguranca">Gerar códigos</Link>
        </div>
        {notificationPermission === "default" && (
          <div className="notification-prompt">
            <Bell size={19} />
            <span>
              Saiba quando chegar uma mensagem enquanto esta aba estiver aberta.
            </span>
            <button
              className="btn btn-outline"
              onClick={async () =>
                setNotificationPermission(
                  await Notification.requestPermission(),
                )
              }
            >
              Ativar notificações
            </button>
          </div>
        )}
        {err && <div className="error">{err}</div>}
        {open && (
          <form className="panel create-form" onSubmit={create}>
            <h2>Um novo grupo ✳</h2>
            <div className="form-grid">
              <label>
                Nome do grupo
                <input
                  required
                  value={name}
                  onChange={(e) => SN(e.target.value)}
                  placeholder="Ex.: Natal da família"
                />
              </label>
              <label>
                Data da confraternização
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => SE(e.target.value)}
                />
              </label>
              <label>
                Valor sugerido
                <input
                  value={budget}
                  onChange={(e) => SB(e.target.value)}
                  placeholder="Ex.: até R$ 100"
                />
              </label>
              <label>
                Descrição
                <input
                  value={description}
                  onChange={(e) => SD(e.target.value)}
                  placeholder="Um recado para o grupo"
                />
              </label>
            </div>
            <button className="btn btn-pink">
              Criar grupo <ArrowUpRight size={18} />
            </button>
          </form>
        )}
        <div className="list-head">
          <h2>
            Seus grupos <span>{String(groups.length).padStart(2, "0")}</span>
          </h2>
        </div>
        {groups.length ? (
          <div className="groups-grid">
            {groups.map((g) => (
              <Link className="group-card" to={"/grupo/" + g.id} key={g.id}>
                <div className="card-top">
                  <span className="pill">
                    {g.status === "drawn"
                      ? "SORTEADO"
                      : g.status === "needs_adjustment"
                        ? "PRECISA DE AJUSTES"
                        : "EM PREPARAÇÃO"}
                  </span>
                  <ArrowUpRight />
                </div>
                {g.unread > 0 && (
                  <span className="unread-badge">
                    <Bell size={13} /> {g.unread}{" "}
                    {g.unread === 1
                      ? "mensagem não lida"
                      : "mensagens não lidas"}
                  </span>
                )}
                <div className="card-spark">✳</div>
                <h3>{g.name}</h3>
                <p>
                  {g.count} {g.count === 1 ? "participante" : "participantes"}{" "}
                  {g.eventDate
                    ? " · " + g.eventDate.split("-").reverse().join("/")
                    : ""}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty">
            <span>✳</span>
            <h3>O primeiro encontro começa aqui.</h3>
            <p>Crie um grupo e convide suas pessoas favoritas.</p>
            <button className="btn btn-navy" onClick={() => SO(true)}>
              Criar meu primeiro grupo
            </button>
          </div>
        )}
        <div className="account-links">
          <Link to="/seguranca">Segurança e códigos de recuperação</Link>
        </div>
      </main>
    </Shell>
  );
}
