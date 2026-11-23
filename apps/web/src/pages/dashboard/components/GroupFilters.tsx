import { Search, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";

export type GroupFiltersValue = {
  q: string;
  participant: string;
  status: string;
  from: string;
  to: string;
  sort: string;
};
export const defaultGroupFilters: GroupFiltersValue = {
  q: "",
  participant: "",
  status: "",
  from: "",
  to: "",
  sort: "recent",
};
export function GroupFilters({
  value,
  onChange,
}: {
  value: GroupFiltersValue;
  onChange: (next: GroupFiltersValue) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const active = Boolean(
    value.q ||
    value.participant ||
    value.status ||
    value.from ||
    value.to ||
    value.sort !== "recent",
  );
  const set = (key: keyof GroupFiltersValue, field: string) =>
    onChange({ ...value, [key]: field });
  return (
    <section className="group-filters" aria-label="Buscar e filtrar grupos">
      <div className="group-filter-top">
        <label className="group-search">
          <span className="sr-only">Buscar grupos pelo nome ou descrição</span>
          <Search size={19} aria-hidden="true" />
          <input
            type="search"
            value={value.q}
            onChange={(e) => set("q", e.target.value)}
            placeholder="Buscar pelo nome ou descrição"
            maxLength={100}
          />
        </label>
        <button
          type="button"
          className="btn btn-outline filter-toggle"
          aria-expanded={expanded}
          aria-controls="group-advanced-filters"
          onClick={() => setExpanded(!expanded)}
        >
          <SlidersHorizontal size={17} /> Filtros
          {(value.participant ||
            value.status ||
            value.from ||
            value.to ||
            value.sort !== "recent") && (
            <span className="filter-indicator" aria-label="Filtros ativos" />
          )}
        </button>
      </div>
      {expanded && (
        <div className="group-filter-fields" id="group-advanced-filters">
          <label>
            Participante
            <input
              value={value.participant}
              onChange={(e) => set("participant", e.target.value)}
              placeholder="Nome de quem participa"
              maxLength={100}
            />
          </label>
          <label>
            Status
            <select
              value={value.status}
              onChange={(e) => set("status", e.target.value)}
            >
              <option value="">Todos os status</option>
              <option value="open">Em preparação</option>
              <option value="scheduled">Agendado</option>
              <option value="drawn">Sorteado</option>
              <option value="needs_adjustment">Precisa de ajustes</option>
            </select>
          </label>
          <label>
            Confraternização a partir de
            <input
              type="date"
              value={value.from}
              max={value.to || undefined}
              onChange={(e) => set("from", e.target.value)}
            />
          </label>
          <label>
            Confraternização até
            <input
              type="date"
              value={value.to}
              min={value.from || undefined}
              onChange={(e) => set("to", e.target.value)}
            />
          </label>
          <label>
            Ordenar por
            <select
              value={value.sort}
              onChange={(e) => set("sort", e.target.value)}
            >
              <option value="recent">Criados recentemente</option>
              <option value="oldest">Criados há mais tempo</option>
              <option value="event_asc">Data mais próxima</option>
              <option value="event_desc">Data mais distante</option>
            </select>
          </label>
        </div>
      )}
      {active && (
        <button
          type="button"
          className="group-clear"
          onClick={() => onChange(defaultGroupFilters)}
        >
          <X size={14} /> Limpar busca e filtros
        </button>
      )}
    </section>
  );
}
