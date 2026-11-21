/** Calendar dates are not instants and must never be parsed through Date. */
export function formatCalendarDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

/** Convert a wall-clock datetime in São Paulo to an absolute instant. */
export function saoPauloToISOString(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error("Escolha uma data e horário válidos.");
  const [date, time] = value.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = (instant: number) =>
    Object.fromEntries(
      formatter
        .formatToParts(instant)
        .map((part) => [part.type, Number(part.value)]),
    );
  let instant = target;
  for (let i = 0; i < 3; i++) {
    const p = parts(instant);
    instant += target - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  }
  const p = parts(instant);
  if (
    p.year !== year ||
    p.month !== month ||
    p.day !== day ||
    p.hour !== hour ||
    p.minute !== minute
  )
    throw new Error(
      "Este horário não existe no fuso de São Paulo. Escolha outro.",
    );
  return new Date(instant).toISOString();
}
export function formatSaoPaulo(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
