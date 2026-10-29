/** Only allow same-site relative redirects (prevents open-redirect abuse via ?callbackUrl=). */
export function safeRedirect(target: string | null | undefined, fallback = "/") {
  if (!target || !target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) return fallback;
  return target;
}
