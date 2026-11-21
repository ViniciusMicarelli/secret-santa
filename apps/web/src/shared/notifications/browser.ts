/** Optional browser notifications never include sender, message or draw details. */
export function notifyNewMessages(
  previous: number,
  current: number,
  groupName: string,
) {
  if (
    current <= previous ||
    !document.hidden ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  )
    return;
  try {
    new Notification("Nova mensagem no Entre Nós", {
      body: `Você tem uma nova mensagem em ${groupName}.`,
      tag: "entre-nos-mensagem",
    });
  } catch {
    /* In-app indicators remain available if browser notifications fail. */
  }
}
