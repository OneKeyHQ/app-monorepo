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
