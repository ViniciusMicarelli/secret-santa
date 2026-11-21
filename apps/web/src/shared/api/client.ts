const inFlight = new Map<string, Promise<any>>();
export function api(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<any> {
  const key = method + " " + path + " " + JSON.stringify(data);
  if (method !== "GET" && inFlight.has(key)) return inFlight.get(key)!;
  const active = document.activeElement;
  const button = active instanceof HTMLButtonElement ? active : null;
  if (method !== "GET" && button) button.disabled = true;
  const request = (async () => {
    const r = await fetch("/api" + path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    const j = await r.json();
    if (!r.ok)
      throw Object.assign(new Error(j.error || "Algo deu errado."), {
        status: r.status,
      });
    return j;
  })();
  if (method !== "GET") inFlight.set(key, request);
  void request
    .then(
      () => {
        if (method !== "GET")
          setTimeout(() => {
            if (inFlight.get(key) === request) inFlight.delete(key);
          }, 800);
      },
      () => {
        if (method !== "GET") inFlight.delete(key);
      },
    )
    .finally(() => {
      if (button?.isConnected) button.disabled = false;
    })
    .catch(() => {});
  return request;
}
