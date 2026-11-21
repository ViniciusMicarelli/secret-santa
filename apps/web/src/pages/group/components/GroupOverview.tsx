import { useState } from "react";
import { Check, Copy, Sparkles, Users } from "lucide-react";
import { api } from "../../../shared/api/client";
import { ScratchCard } from "../../../features/reveal/ScratchCard";
import type { Group, User } from "../../../shared/types";
type Props = {
  group: Group;
  user: User;
  action: (path: string, data: unknown) => Promise<void>;
  load: () => Promise<unknown>;
  setError: (message: string) => void;
};
export function GroupOverview({
  group: g,
  user,
  action,
  load,
  setError,
}: Props) {
  const [at, setAt] = useState(""),
    [copied, setCopied] = useState(false);
  const invite = location.origin + "/convite/" + g.invite;
  return (
    <div className="detail-grid">
      <div>
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="kicker">A TURMA ESTÁ REUNIDA</div>
              <h2>
                Participantes <span className="muted">{g.members.length}</span>
              </h2>
            </div>
            <Users />
          </div>
          <div className="members">
            {g.members.map((m) => (
              <div className="member" key={m.id}>
                <span className="member-avatar">
                  {m.name.charAt(0).toUpperCase()}
                </span>
                <div>
                  <strong>
                    {m.name}
                    {m.id === user.id ? " (você)" : ""}
                  </strong>
                  <small>
                    {m.family ? "Família: " + m.family : "Sem família definida"}
                  </small>
                </div>
                {g.owner && g.status !== "drawn" && (
                  <button
                    onClick={() => {
                      const f = prompt(
                        "Nome da família ou casa (deixe vazio para remover):",
                        m.family,
                      );
                      if (f !== null)
                        action("family", { userId: m.id, family: f });
                    }}
                  >
                    Editar
                  </button>
                )}
                {g.owner && g.status !== "drawn" && m.id !== user.id && (
                  <button
                    onClick={async () => {
                      if (
                        confirm(
                          "Remover este participante e suas ideias de presente? O convite atual também será revogado.",
                        )
                      ) {
                        try {
                          await api(
                            `/groups/${g.id}/members/${m.id}`,
                            "DELETE",
                          );
                          await load();
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }
                    }}
                  >
                    Remover
                  </button>
                )}
              </div>
            ))}
          </div>
          {g.status !== "drawn" && (
            <div className="invite-box">
              <div>
                <strong>Convide mais pessoas</strong>
                <p>Compartilhe este link com quem vai participar.</p>
              </div>
              <button
                className="btn btn-outline"
                onClick={() =>
                  navigator.clipboard.writeText(invite).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  })
                }
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}{" "}
                {copied ? "Copiado" : "Copiar convite"}
              </button>
              {g.owner && (
                <button
                  className="link-button"
                  onClick={() => {
                    if (
                      confirm(
                        "Gerar outro convite? O link anterior deixará de funcionar.",
                      )
                    )
                      action("invite", {});
                  }}
                >
                  Revogar e gerar outro
                </button>
              )}
            </div>
          )}
        </div>
        {g.targetId > 0 && <ScratchCard name={g.targetName} />}
      </div>
      <aside>
        <div className="panel">
          <div className="kicker">OS DETALHES</div>
          <h2>Sobre o encontro</h2>
          <div className="detail-row">
            <span>Confraternização</span>
            <strong>
              {g.eventDate
                ? g.eventDate.split("-").reverse().join("/")
                : "A combinar"}
            </strong>
          </div>
          <div className="detail-row">
            <span>Valor sugerido</span>
            <strong>{g.budget || "A combinar"}</strong>
          </div>
          <div className="detail-row">
            <span>Sorteio</span>
            <strong>
              {g.scheduledAt
                ? new Date(g.scheduledAt).toLocaleString("pt-BR")
                : g.status === "drawn"
                  ? "Realizado"
                  : "Ainda não marcado"}
            </strong>
          </div>
        </div>
        {g.owner && g.status !== "drawn" && (
          <div className="panel">
            <div className="kicker">ORGANIZADOR</div>
            <h2>Hora do sorteio</h2>
            <p className="panel-copy">
              São necessárias pelo menos 3 pessoas. Integrantes da mesma família
              não se tiram.
            </p>
            {g.status === "needs_adjustment" && (
              <div className="error">
                O sorteio agendado não pôde ser realizado. Revise participantes
                e famílias.
              </div>
            )}
            <button
              className="btn btn-navy full"
              onClick={() => {
                if (
                  confirm(
                    "Sortear agora? Os pares serão liberados para todos e não poderão ser alterados.",
                  )
                )
                  action("draw", {});
              }}
            >
              Sortear agora <Sparkles size={17} />
            </button>
            <div className="divider">ou agende</div>
            <label>
              Data e horário
              <input
                type="datetime-local"
                value={at}
                onChange={(e) => setAt(e.target.value)}
              />
            </label>
            <button
              className="btn btn-outline full"
              onClick={() => {
                if (at) action("schedule", { at: new Date(at).toISOString() });
                else setError("Escolha uma data e horário.");
              }}
            >
              Agendar sorteio
            </button>
            {g.scheduledAt && (
              <button
                className="link-button"
                onClick={() => action("schedule", { at: null })}
              >
                Cancelar agendamento
              </button>
            )}
            <p className="small">
              Horário local do seu dispositivo. A execução pode levar alguns
              minutos.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
