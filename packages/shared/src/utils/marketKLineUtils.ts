export function normalizeMarketApiKLineInterval(
  interval: string | undefined,
): string | undefined {
  const unit = interval?.slice(-1);

  if (unit === 'm' || unit === 's') {
    return interval?.toLowerCase();
  }

  return interval?.toUpperCase();
}
