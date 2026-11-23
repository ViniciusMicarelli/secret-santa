import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { useDialog } from "../../../shared/ui/useDialog";
import { api } from "../../../shared/api/client";
import type { Group } from "../../../shared/types";
type Message = { id: number; mine: boolean; content: string };
type Props = {
  group: Group;
  kind: string;
  setKind: (kind: string) => void;
  messages: Message[];
  setMessages: (messages: Message[]) => void;
  setError: (message: string) => void;
};
export function ChatPanel({
  group: g,
  kind,
  setKind,
  messages,
  setMessages,
  setError,
}: Props) {
  const { ask, dialog } = useDialog();
  const [reported, setReported] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messageList = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const list = messageList.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [kind, messages]);
  async function send(e: FormEvent) {
    e.preventDefault();
    if (sending || !message.trim()) return;
    setSending(true);
    try {
      const msgs = await api(`/groups/${g.id}/chat/${kind}`, "POST", {
        content: message,
      });
      setMessages(msgs);
      setMessage("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }
  return (
    <>
      <div className="panel chat-panel">
        <div className="kicker">O SEGREDO CONTINUA SEGURO</div>
        <h2>Conversas anônimas</h2>
        <p className="panel-copy">
          Não compartilhe informações que possam revelar quem você é.
        </p>
        <div className="chat-switch">
          <button
            className={kind === "outgoing" ? "active" : ""}
            onClick={() => setKind("outgoing")}
          >
            Pessoa que tirei {g.unread.outgoing > 0 && `(${g.unread.outgoing})`}
          </button>
          <button
            className={kind === "incoming" ? "active" : ""}
            onClick={() => setKind("incoming")}
          >
            Quem me tirou {g.unread.incoming > 0 && `(${g.unread.incoming})`}
          </button>
        </div>
        <div className="messages" ref={messageList}>
          {messages.length ? (
            messages.map((m) => (
              <div
                className={
                  "message " +
                  (m.mine ? "mine " : "") +
                  (m.id === messages[messages.length - 1]?.id
                    ? "message-latest"
                    : "")
                }
                key={m.id}
              >
                {m.content}
              </div>
            ))
          ) : (
            <p>Nenhuma mensagem ainda. Comece com um oi!</p>
          )}
        </div>
        <button
          className="report-button"
          onClick={async () => {
            const reason = await ask({
              title: "Denunciar conversa",
              description: "Conte o que aconteceu para registrar a denúncia.",
              confirm: "Enviar denúncia",
              input: { label: "O que aconteceu?", required: true },
            });
            if (reason === null) return;
            try {
              await api(`/groups/${g.id}/chat/${kind}/report`, "POST", {
                reason,
              });
              setReported(true);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Denunciar conversa
        </button>
        {reported && (
          <p className="report-success" role="status">
            Denúncia registrada. Obrigado por avisar.
          </p>
        )}
        <form className="chat-form" onSubmit={send}>
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Escreva sua mensagem..."
            maxLength={2000}
            required
          />
          <button className="btn btn-navy" disabled={sending}>
            {sending ? "Enviando..." : "Enviar"}
          </button>
        </form>
      </div>
      {dialog}
    </>
  );
}
