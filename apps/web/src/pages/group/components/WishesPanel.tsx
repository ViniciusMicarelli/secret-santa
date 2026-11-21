import { useState } from "react";
import { ExternalLink, Plus, Star } from "lucide-react";
import { api } from "../../../shared/api/client";
import type { Group, User } from "../../../shared/types";
type Props = {
  group: Group;
  user: User;
  action: (path: string, data: unknown) => Promise<void>;
  load: () => Promise<unknown>;
  setError: (message: string) => void;
};
export function WishesPanel({ group: g, user, action, load, setError }: Props) {
  const [title, setTitle] = useState(""),
    [detail, setDetail] = useState(""),
    [link, setLink] = useState(""),
    [editing, setEditing] = useState<number | null>(null);
  const mine = g.wishes.filter((w) => w.userId === user.id),
    theirs = g.wishes.filter((w) => w.userId === g.targetId);
  const clear = () => {
    setTitle("");
    setDetail("");
    setLink("");
    setEditing(null);
  };
  return (
    <div className="detail-grid">
      <div className="panel wish-panel wish-panel-mine">
        <div className="kicker">DÊ UMA PISTA</div>
        <h2>Minha lista de desejos</h2>
        <p className="panel-copy">
          Até cinco ideias para ajudar quem tirou você.
        </p>
        {mine.map((w) => (
          <div className="wish" key={w.id}>
            <div>
              <strong>
                {w.favorite && (
                  <Star
                    className="wish-star"
                    size={15}
                    aria-label="Favorito"
                    fill="currentColor"
                  />
                )}
                {w.title}
              </strong>
              <p>{w.detail}</p>
              {w.link && (
                <a href={w.link} target="_blank" rel="noopener noreferrer">
                  Ver link <ExternalLink size={13} aria-hidden="true" />
                </a>
              )}
            </div>
            <div className="wish-actions">
              <button
                onClick={() => {
                  setEditing(w.id);
                  setTitle(w.title);
                  setDetail(w.detail);
                  setLink(w.link);
                }}
              >
                Editar
              </button>
              <button onClick={() => action(`wish/${w.id}/favorite`, {})}>
                {w.favorite ? "Favorito" : "Favoritar"}
              </button>
              <button
                onClick={async () => {
                  try {
                    await api(`/groups/${g.id}/wish/${w.id}`, "DELETE");
                    await load();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Remover
              </button>
            </div>
          </div>
        ))}
        {(mine.length < 5 || editing !== null) && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api(
                  `/groups/${g.id}/wish${editing !== null ? "/" + editing : ""}`,
                  editing !== null ? "PUT" : "POST",
                  { title, detail, link },
                );
                clear();
                await load();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <label>
              Ideia de presente
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Algo que você gostaria de ganhar"
              />
            </label>
            <label>
              Detalhes
              <input
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="Cor, tamanho ou uma dica"
              />
            </label>
            <label>
              Link opcional
              <input
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://..."
              />
            </label>
            <button className="btn btn-navy">
              <Plus size={17} />{" "}
              {editing !== null ? "Salvar alterações" : "Adicionar ideia"}
            </button>
            {editing !== null && (
              <button type="button" className="link-button" onClick={clear}>
                Cancelar edição
              </button>
            )}
          </form>
        )}
      </div>
      <div className="panel wish-panel wish-panel-theirs">
        <div className="kicker">UMA AJUDINHA PARA VOCÊ</div>
        <h2>Lista de quem você tirou</h2>
        {g.targetId ? (
          theirs.length ? (
            theirs.map((w) => (
              <div className="wish" key={w.id}>
                <div>
                  <strong>
                    {w.favorite && (
                      <Star
                        className="wish-star"
                        size={15}
                        aria-label="Favorito"
                        fill="currentColor"
                      />
                    )}
                    {w.title}
                  </strong>
                  <p>{w.detail}</p>
                  {w.link && (
                    <a href={w.link} target="_blank" rel="noopener noreferrer">
                      Ver link <ExternalLink size={13} aria-hidden="true" />
                    </a>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="panel-copy">
              Ainda não há ideias por aqui. Que tal pedir uma dica no chat?
            </p>
          )
        ) : (
          <p className="panel-copy">
            A lista estará disponível depois do sorteio.
          </p>
        )}
      </div>
    </div>
  );
}
