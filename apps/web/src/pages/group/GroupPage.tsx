import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { notifyNewMessages } from "../../shared/notifications/browser";
import { api } from "../../shared/api/client";
import { Shell } from "../../shared/ui/Shell";
import type { Group, User } from "../../shared/types";
import { GroupOverview } from "./components/GroupOverview";
import { WishesPanel } from "./components/WishesPanel";
import { ChatPanel } from "./components/ChatPanel";

type Message = { id: number; mine: boolean; content: string };
export function GroupPage({ user }: { user: User }) {
  const { id } = useParams();
  const [group, setGroup] = useState<Group | null>(null),
    [error, setError] = useState(""),
    [tab, setTab] = useState("grupo"),
    [kind, setKind] = useState("outgoing"),
    [messages, setMessages] = useState<Message[]>([]);
  const lastUnread = useRef<number | null>(null);
  const load = (notify = false) =>
    api("/groups/" + id)
      .then((next: Group) => {
        const total = next.unread.incoming + next.unread.outgoing;
        if (notify && lastUnread.current !== null)
          notifyNewMessages(lastUnread.current, total, next.name);
        lastUnread.current = total;
        setGroup(next);
      })
      .catch((e) => {
        if (e.status === 401 || e.status === 403) setGroup(null);
        setError(e.message);
      });
  useEffect(() => {
    load();
  }, [id]);
  useEffect(() => {
    if (!id) return;
    let socket: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false,
      attempts = 0;
    const refreshChat = () => {
      if (tab !== "conversas" || !group?.targetId || document.hidden) return;
      api(`/groups/${id}/chat/${kind}`)
        .then((data) => {
          if (stopped) return;
          setMessages(data);
          load();
          setGroup((current) =>
            current
              ? { ...current, unread: { ...current.unread, [kind]: 0 } }
              : current,
          );
        })
        .catch((e) => {
          if (!stopped) setError(e.message);
        });
    };
    const connect = () => {
      if (stopped) return;
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(
        `${protocol}//${location.host}/api/groups/${id}/events`,
      );
      socket.onopen = () => {
        attempts = 0;
        load();
        refreshChat();
      };
      socket.onmessage = (event) => {
        try {
          const update = JSON.parse(event.data);
          if (
            update.type === "group" ||
            update.type === "chat" ||
            update.type === "read"
          )
            load(update.type === "chat");
          if (update.type === "chat") refreshChat();
        } catch {
          /* Ignore malformed events. */
        }
      };
      socket.onclose = () => {
        if (stopped) return;
        load();
        timer = setTimeout(
          connect,
          Math.min(1000 * 2 ** attempts++, 30000) + Math.random() * 500,
        );
      };
      socket.onerror = () => socket?.close();
    };
    connect();
    const onVisibilityChange = () => {
      if (!document.hidden) {
        refreshChat();
        load();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (timer) clearTimeout(timer);
      socket?.close();
    };
  }, [id, tab, kind, group?.targetId]);
  async function action(path: string, data: unknown) {
    setError("");
    try {
      await api(`/groups/${id}/${path}`, "POST", data);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!group)
    return (
      <Shell>
        <div className="wrap app-content">{error || "Carregando..."}</div>
      </Shell>
    );
  return (
    <Shell>
      <main className="wrap app-content">
        <Link className="back" to="/app">
          ← Todos os grupos
        </Link>
        <div className="group-heading">
          <div>
            <div className="kicker">SEU GRUPO DE AMIGO SECRETO</div>
            <h1>
              {group.name}
              <span className="pink">.</span>
            </h1>
            <p>{group.description || "Uma boa surpresa está a caminho."}</p>
          </div>
          <span className="pill">
            {group.status === "drawn"
              ? "SORTEIO REALIZADO"
              : group.status === "needs_adjustment"
                ? "PRECISA DE AJUSTES"
                : group.scheduledAt
                  ? "SORTEIO AGENDADO"
                  : "EM PREPARAÇÃO"}
          </span>
        </div>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <div className="tabs">
          {["grupo", "presentes", ...(group.targetId ? ["conversas"] : [])].map(
            (x) => (
              <button
                key={x}
                className={tab === x ? "active" : ""}
                onClick={() => setTab(x)}
              >
                {x === "grupo"
                  ? "O grupo"
                  : x === "presentes"
                    ? "Presentes"
                    : "Conversas" +
                      (group.unread.incoming + group.unread.outgoing > 0
                        ? " (" +
                          (group.unread.incoming + group.unread.outgoing) +
                          ")"
                        : "")}
              </button>
            ),
          )}
        </div>
        {tab === "grupo" && (
          <GroupOverview
            group={group}
            user={user}
            action={action}
            load={load}
            setError={setError}
          />
        )}
        {tab === "presentes" && (
          <WishesPanel
            group={group}
            user={user}
            action={action}
            load={load}
            setError={setError}
          />
        )}
        {tab === "conversas" && (
          <ChatPanel
            group={group}
            kind={kind}
            setKind={(next) => {
              setMessages([]);
              setKind(next);
            }}
            messages={messages}
            setMessages={setMessages}
            setError={setError}
          />
        )}
      </main>
    </Shell>
  );
}
