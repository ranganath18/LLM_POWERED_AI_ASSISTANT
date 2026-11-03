const number = new Intl.NumberFormat();

/** "1,074" (or "~1,074" when the backend had to estimate it). */
export function formatCount(value, estimated) {
  return `${estimated ? "~" : ""}${number.format(value ?? 0)}`;
}

/** 850 → "0.85s", 2400 → "2.4s", 61000 → "1m 1s". */
export function formatDuration(ms) {
  if (ms == null) return "";
  const seconds = ms / 1000;
  if (seconds < 1) return `${seconds.toFixed(2)}s`;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

/** Tooltip text with the per-call breakdown. */
export function usageBreakdown(usage) {
  if (!usage) return "";
  const line = (label, part) =>
    `${label}: ${formatCount(part.input_tokens, part.estimated)} in · ${formatCount(part.output_tokens, part.estimated)} out`;
  return [line("Intent detection", usage.classification), line("Reply", usage.reply)].join("\n");
}
