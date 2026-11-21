export function safeDestination(value: string | null): string {
  if (
    !value ||
    !/^\/(?:app|seguranca|grupo\/\d+|convite\/[a-f0-9]{64})$/.test(value)
  )
    return "/app";
  return value;
}
