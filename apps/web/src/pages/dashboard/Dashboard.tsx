import { formatCalendarDate } from "../../shared/time/saoPaulo";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, Gift, LockKeyhole, Plus, Sparkles } from "lucide-react";
import { api } from "../../shared/api/client";
import { Shell } from "../../shared/ui/Shell";
import { notifyNewMessages } from "../../shared/notifications/browser";
import {
  GroupFilters,
  defaultGroupFilters,
  type GroupFiltersValue,
} from "./components/GroupFilters";
import type {
  Group,
  GroupSearchResult,
  GroupSummary,
  User,
} from "../../shared/types";

export function Dashboard({ user }: { user: User }) {
  const [groups, SG] = useState<GroupSummary[]>([]),
    [open, SO] = useState(false),
    [name, SN] = useState(""),
    [description, SD] = useState(""),
    [eventDate, SE] = useState(""),
    [budget, SB] = useState(""),
    [err, SR] = useState("");
  const [filters, setFilters] =
    useState<GroupFiltersValue>(defaultGroupFilters);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const requestVersion = useRef(0);
  const nav = useNavigate();
  const groupsRef = useRef<GroupSummary[]>([]);
  const [notificationPermission, setNotificationPermission] = useState(() =>
    "Notification" in window ? Notification.permission : "unsupported",
  );
  const unreadByGroup = useRef(new Map<number, number>());
  const searchUrl = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      sort: filters.sort,
    });
    for (const key of ["q", "participant", "status", "from", "to"] as const)
      if (filters[key].trim()) params.set(key, filters[key].trim());
    return "/groups/search?" + params.toString();
  }, [filters, page]);
  const refreshGroups = useCallback(
    (notify = false) => {
      const version = ++requestVersion.current;
      return api(searchUrl)
        .then((result: GroupSearchResult) => {
          if (version !== requestVersion.current) return;
          if (notify)
            for (const group of result.items) {
              const previous = groupsRef.current.find((g) => g.id === group.id);
              if (previous)
                notifyNewMessages(previous.unread, group.unread, group.name);
            }
          for (const group of result.items)
            unreadByGroup.current.set(group.id, group.unread);
          groupsRef.current = result.items;
          SG(result.items);
          setTotal(result.total);
          setTotalPages(result.totalPages);
          setLoading(false);
          SR("");
          if (result.totalPages > 0 && page > result.totalPages)
            setPage(result.totalPages);
        })
        .catch((e) => {
          if (version === requestVersion.current) {
            SR(e.message || "Não foi possível buscar os grupos.");
            setLoading(false);
          }
        });
    },
    [searchUrl, page],
  );
  const refreshRef = useRef(refreshGroups);
  refreshRef.current = refreshGroups;
  useEffect(() => {
    requestVersion.current++;
    setLoading(true);
    const timer = window.setTimeout(() => refreshGroups(), 300);
    return () => {
      window.clearTimeout(timer);
      requestVersion.current++;
    };
  }, [refreshGroups]);
  useEffect(() => {
    let stopped = false,
      attempt = 0;
    let socket: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
      if (stopped) return;
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${location.host}/api/events`);
      socket.onopen = () => {
        attempt = 0;
        refreshRef.current();
      };
      socket.onmessage = (event) => {
        try {
          const update = JSON.parse(event.data);
          if (
            !["chat", "group", "read"].includes(update.type) ||
            !Number.isSafeInteger(update.group) ||
            update.group < 1
          )
            return;
          if (
            update.type === "chat" &&
            document.hidden &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            const previous = unreadByGroup.current.get(update.group) ?? 0;
            api(`/groups/${update.group}`)
              .then((group: Group) => {
                if (stopped) return;
                const current = group.unread.incoming + group.unread.outgoing;
                notifyNewMessages(previous, current, group.name);
                unreadByGroup.current.set(group.id, current);
              })
              .catch(() => {});
          }
          refreshRef.current();
        } catch {
          /* Ignore malformed events. */
        }
      };
      socket.onclose = () => {
        if (!stopped)
          timer = setTimeout(
            connect,
            Math.min(1000 * 2 ** attempt++, 30000) + Math.random() * 500,
          );
      };
      socket.onerror = () => socket?.close();
    };
    connect();
    const visible = () => {
      if (!document.hidden) refreshRef.current();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      socket?.close();
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
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
            <h2>Um novo grupo</h2>
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
            <button className="btn btn-pink">Criar grupo</button>
          </form>
        )}
        <div className="list-head">
          <h2>
            Seus grupos <span>{String(total).padStart(2, "0")}</span>
          </h2>
        </div>
        <GroupFilters
          value={filters}
          onChange={(next) => {
            setFilters(next);
            setPage(1);
          }}
        />
        <p className="search-count" aria-live="polite">
          {loading
            ? "Buscando grupos..."
            : `${total} ${total === 1 ? "grupo encontrado" : "grupos encontrados"}`}
        </p>
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
                        : g.scheduledAt
                          ? "AGENDADO"
                          : "EM PREPARAÇÃO"}
                  </span>
                </div>
                {g.unread > 0 && (
                  <span className="unread-badge">
                    <Bell size={13} /> {g.unread}{" "}
                    {g.unread === 1
                      ? "mensagem não lida"
                      : "mensagens não lidas"}
                  </span>
                )}
                <Sparkles className="card-spark" size={22} aria-hidden="true" />
                <h3>{g.name}</h3>
                <p>
                  {g.count} {g.count === 1 ? "participante" : "participantes"}{" "}
                  {g.eventDate ? " · " + formatCalendarDate(g.eventDate) : ""}
                </p>
              </Link>
            ))}
          </div>
        ) : !loading && !err ? (
          <div className="empty">
            <Gift className="empty-icon" size={32} aria-hidden="true" />
            {filters.q ||
            filters.participant ||
            filters.status ||
            filters.from ||
            filters.to ? (
              <>
                <h3>Nenhum grupo encontrado.</h3>
                <p>Tente outra busca ou ajuste os filtros.</p>
                <button
                  className="btn btn-outline"
                  onClick={() => {
                    setFilters(defaultGroupFilters);
                    setPage(1);
                  }}
                >
                  Limpar filtros
                </button>
              </>
            ) : (
              <>
                <h3>O primeiro encontro começa aqui.</h3>
                <p>Crie um grupo e convide suas pessoas favoritas.</p>
                <button className="btn btn-navy" onClick={() => SO(true)}>
                  Criar meu primeiro grupo
                </button>
              </>
            )}
          </div>
        ) : null}
        {totalPages > 1 && (
          <nav className="group-pagination" aria-label="Paginação de grupos">
            <button
              className="btn btn-outline"
              disabled={loading || page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </button>
            <span>
              Página {page} de {totalPages}
            </span>
            <button
              className="btn btn-outline"
              disabled={loading || page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </button>
          </nav>
        )}
        <div className="account-links">
          <Link to="/seguranca">Segurança e códigos de recuperação</Link>
        </div>
      </main>
    </Shell>
  );
}
