const BASE = "http://redirect.invalid";

/**
 * Only allow same-site relative redirects (prevents open-redirect abuse via
 * ?callbackUrl=). Control characters and backslashes are rejected outright
 * because browsers strip or normalise them (e.g. "/\t/evil.com" -> "//evil.com").
 */
export function safeRedirect(target: string | null | undefined, fallback = "/") {
  if (!target || typeof target !== "string") return fallback;
  if (/[\u0000-\u001F\u007F\\]/.test(target)) return fallback;
  if (!target.startsWith("/") || target.startsWith("//")) return fallback;
  try {
    const url = new URL(target, BASE);
    if (url.origin !== BASE) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
