import { useState, type FormEvent } from "react";
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
  const [message, setMessage] = useState("");
  async function send(e: FormEvent) {
    e.preventDefault();
    try {
      const msgs = await api(`/groups/${g.id}/chat/${kind}`, "POST", {
        content: message,
      });
      setMessages(msgs);
      setMessage("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
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
      <div className="messages">
        {messages.length ? (
          messages.map((m) => (
            <div className={"message " + (m.mine ? "mine" : "")} key={m.id}>
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
          const reason = prompt(
            "Descreva o problema para registrar a denúncia:",
          );
          if (reason === null) return;
          try {
            await api(`/groups/${g.id}/chat/${kind}/report`, "POST", {
              reason,
            });
            alert("Denúncia registrada. Obrigado por avisar.");
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        Denunciar conversa
      </button>
      <form className="chat-form" onSubmit={send}>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Escreva sua mensagem..."
          maxLength={2000}
          required
        />
        <button className="btn btn-navy">Enviar</button>
      </form>
    </div>
  );
}
