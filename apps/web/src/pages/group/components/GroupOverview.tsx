import { useState } from "react";
import { Check, Copy, Sparkles, Users } from "lucide-react";
import { useDialog } from "../../../shared/ui/useDialog";
import {
  formatCalendarDate,
  formatSaoPaulo,
  saoPauloToISOString,
} from "../../../shared/time/saoPaulo";
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
  const { ask, dialog } = useDialog();
  const invite = location.origin + "/convite/" + g.invite;
  return (
    <>
      <div className="detail-grid">
        <div>
          <div className="panel">
            <div className="panel-head">
              <div>
                <div className="kicker">A TURMA ESTÁ REUNIDA</div>
                <h2>
                  Participantes{" "}
                  <span className="muted">{g.members.length}</span>
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
                      {m.family
                        ? "Família: " + m.family
                        : "Sem família definida"}
                    </small>
                  </div>
                  {g.owner && g.status !== "drawn" && (
                    <button
                      onClick={async () => {
                        const f = await ask({
                          title: "Família ou casa",
                          description: `Pessoas da mesma família não se sorteiam. Deixe vazio para remover a família de ${m.name}.`,
                          confirm: "Salvar",
                          input: { label: "Nome da família", value: m.family },
                        });
                        if (f !== null)
                          await action("family", { userId: m.id, family: f });
                      }}
                    >
                      Editar
                    </button>
                  )}
                  {g.owner && g.status !== "drawn" && m.id !== user.id && (
                    <button
                      onClick={async () => {
                        if (
                          (await ask({
                            title: "Remover participante?",
                            description: `As ideias de presente de ${m.name} serão removidas e o convite atual será revogado.`,
                            confirm: "Remover",
                          })) !== null
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
                    onClick={async () => {
                      if (
                        (await ask({
                          title: "Gerar outro convite?",
                          description: "O link anterior deixará de funcionar.",
                          confirm: "Gerar convite",
                        })) !== null
                      )
                        await action("invite", {});
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
                {g.eventDate ? formatCalendarDate(g.eventDate) : "A combinar"}
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
                  ? formatSaoPaulo(g.scheduledAt)
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
                São necessárias pelo menos 3 pessoas. Integrantes da mesma
                família não se tiram.
              </p>
              {g.status === "needs_adjustment" && (
                <div className="error">
                  O sorteio agendado não pôde ser realizado. Revise
                  participantes e famílias.
                </div>
              )}
              <button
                className="btn btn-navy full"
                onClick={async () => {
                  if (g.members.length < 3) {
                    setError(
                      "São necessárias pelo menos 3 pessoas para sortear.",
                    );
                    return;
                  }
                  if (
                    (await ask({
                      title: "Tudo pronto para sortear?",
                      description:
                        "Os pares serão liberados para todos e não poderão ser alterados.",
                      confirm: "Sortear agora",
                    })) !== null
                  )
                    await action("draw", {});
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
                  try {
                    action("schedule", { at: saoPauloToISOString(at) });
                  } catch (e) {
                    setError((e as Error).message);
                  }
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
                Horário de Brasília (São Paulo). A execução pode levar alguns
                minutos.
              </p>
            </div>
          )}
        </aside>
      </div>
      {dialog}
    </>
  );
}
