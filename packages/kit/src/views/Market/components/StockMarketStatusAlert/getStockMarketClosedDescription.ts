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

/**
 * Backend descriptions can be full sentences ending with sentence punctuation
 * (e.g. a halted stock's "该股票目前停牌，暂时无法交易。"), while the `{time}`
 * templates supply their own separator ("{time}，您仍然可以…"). Strip the
 * trailing punctuation before interpolating so the result never renders a
 * doubled "。，" / ".," (OK-58554). Countdown lines have no trailing
 * punctuation, so this is a no-op for them.
 */
export function stripTrailingSentencePunctuation(text: string): string {
  return text.replace(/[。．.！!？?，,、；;：:]+$/u, '');
}
