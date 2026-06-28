/**
 * Extract the user-facing countdown line from a backend stock `description`.
 *
 * The backend `tokenDetail.stock.description` is a localized multi-line string
 * (when closed: "countdown\n…tooltip…"). We show only the first non-empty line
 * as the countdown, and treat a generic provider blurb as "no countdown" so
 * callers fall back to the no-time copy. Shared by every surface that renders
 * the stock market-status alert (Swap stock tab, Market detail, etc.).
 */
export function getStockMarketClosedDescription(reason?: string | null) {
  const firstLine = reason
    ?.split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine || /\bondo\b/i.test(firstLine)) {
    return undefined;
  }

  return firstLine;
}
