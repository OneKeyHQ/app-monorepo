// cspell:words Ondo

const ONDO_STOCK_SOURCES = new Set(['coingecko', 'ondo']);

function normalizeStockSource(source?: string | null) {
  const normalizedSource = source?.trim().toLowerCase();

  if (!normalizedSource) {
    return undefined;
  }

  return normalizedSource;
}

export function isOndoStockSource(source?: string | null) {
  const normalizedSource = normalizeStockSource(source);

  if (!normalizedSource) {
    return false;
  }

  return ONDO_STOCK_SOURCES.has(normalizedSource);
}
