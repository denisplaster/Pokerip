const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("en-US");

/** Formats a Rip Coin amount, e.g. 12,500 RC. */
export function formatRC(amount: number, opts: { compact?: boolean; sign?: boolean } = {}) {
  const sign = opts.sign && amount > 0 ? "+" : "";
  const body = opts.compact && Math.abs(amount) >= 10_000 ? compact.format(amount) : full.format(amount);
  return `${sign}${body} RC`;
}

export function formatNumber(n: number, opts: { compact?: boolean } = {}) {
  return opts.compact && Math.abs(n) >= 10_000 ? compact.format(n) : full.format(n);
}

/** Formats a probability (0..1) as a readable percentage with enough precision for tiny odds. */
export function formatProbability(p: number) {
  if (p <= 0) return "0%";
  const pct = p * 100;
  if (pct >= 10) return `${pct.toFixed(1)}%`;
  if (pct >= 1) return `${pct.toFixed(2)}%`;
  if (pct >= 0.01) return `${pct.toFixed(3)}%`;
  return `${pct.toPrecision(2)}%`;
}

/** Formats parts-per-million as a percentage string. */
export function formatPpm(ppm: number) {
  return formatProbability(ppm / 1_000_000);
}

/** "1 in N" representation for odds. */
export function formatOneIn(p: number) {
  if (p <= 0) return "—";
  const n = 1 / p;
  if (n < 10) return `1 in ${n.toFixed(1)}`;
  return `1 in ${full.format(Math.round(n))}`;
}

export function formatPercentChange(change: number | null | undefined) {
  if (change === null || change === undefined || !Number.isFinite(change)) return "—";
  const sign = change > 0 ? "+" : "";
  return `${sign}${(change * 100).toFixed(1)}%`;
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function timeAgo(date: Date | string | number) {
  const d = new Date(date).getTime();
  const diff = (d - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return "just now";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  if (abs < 86400 * 365) return rtf.format(Math.round(diff / (86400 * 30)), "month");
  return rtf.format(Math.round(diff / (86400 * 365)), "year");
}

export function formatDate(date: Date | string, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" }) {
  return new Intl.DateTimeFormat("en-US", opts).format(new Date(date));
}

export function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  if (d > 0) return `${d}d ${Math.floor((total % 86400) / 3600)}h`;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}
