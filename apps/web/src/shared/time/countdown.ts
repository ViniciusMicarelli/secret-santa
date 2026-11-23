/** Compare instants, independent of the visitor's time zone. */
export function countdownLabel(at: string, now: number): string | null {
  const target = new Date(at).getTime();
  if (!Number.isFinite(target)) return null;
  const minutes = Math.max(0, Math.ceil((target - now) / 60_000));
  if (minutes === 0) return "Aguardando processamento";
  const days = Math.floor(minutes / 1440),
    hours = Math.floor((minutes % 1440) / 60),
    remainder = minutes % 60;
  const remaining =
    days > 0
      ? `${days} ${days === 1 ? "dia" : "dias"}${hours ? ` e ${hours} ${hours === 1 ? "hora" : "horas"}` : ""}`
      : hours > 0
        ? `${hours} ${hours === 1 ? "hora" : "horas"}${remainder ? ` e ${remainder} min` : ""}`
        : `${remainder} min`;
  return `${minutes === 1 || minutes === 60 || minutes === 1440 ? "Falta" : "Faltam"} ${remaining}`;
}
