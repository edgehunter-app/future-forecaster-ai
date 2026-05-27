/**
 * Clean up market question display for multi-option markets that arrive
 * as raw comma-separated "yes Option" strings.
 */
export function cleanMarketTitle(question: string): string {
  if (!question) return "";
  const q = question.trim();
  const lower = q.toLowerCase();
  if (lower.includes(",yes ") || lower.startsWith("yes ")) {
    const options = q
      .split(",")
      .map((o) => o.replace(/^\s*yes\s+/i, "").trim())
      .filter(Boolean);
    if (options.length > 2) return `${options[0]} +${options.length - 1} others`;
    if (options.length > 0) return options[0];
  }
  if (q.length > 80) return q.slice(0, 77) + "...";
  return q;
}