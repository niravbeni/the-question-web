/**
 * Anonymous local identity: the ids of views published from this browser,
 * kept in localStorage so the landscape can mark "you" without any account.
 */
const KEY = "ct-my-pov-ids";

export function getMyPovIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function addMyPovId(id: string): void {
  if (typeof window === "undefined") return;
  const ids = getMyPovIds();
  if (!ids.includes(id)) ids.push(id);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // Storage may be unavailable (private mode); the view still publishes.
  }
}
