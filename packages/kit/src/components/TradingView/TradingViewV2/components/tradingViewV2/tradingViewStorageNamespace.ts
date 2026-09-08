const FORCED_CANDLESTICK_NAMESPACE_SUFFIX = 'forced-candlestick';

export function resolveTradingViewStorageNamespace({
  storageNamespace,
  forceCandlestickChart,
}: {
  storageNamespace?: string;
  forceCandlestickChart: boolean;
}) {
  const baseNamespace = storageNamespace?.trim() || 'market';
  if (!forceCandlestickChart) {
    return baseNamespace;
  }

  const suffix = `-${FORCED_CANDLESTICK_NAMESPACE_SUFFIX}`;
  return baseNamespace.endsWith(suffix)
    ? baseNamespace
    : `${baseNamespace}${suffix}`;
}
