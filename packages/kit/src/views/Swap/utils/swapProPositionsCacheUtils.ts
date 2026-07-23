export const SWAP_PRO_POSITIONS_CACHE_TTL_MS = 30_000;

export function shouldReuseSwapProPositionsCache({
  cacheEntry,
  forceRefresh,
  now = Date.now(),
  ownerKey,
}: {
  cacheEntry?: {
    ownerKey: string;
    updatedAt: number;
  };
  forceRefresh?: boolean;
  now?: number;
  ownerKey: string;
}) {
  return Boolean(
    !forceRefresh &&
    ownerKey &&
    cacheEntry?.ownerKey === ownerKey &&
    now - cacheEntry.updatedAt < SWAP_PRO_POSITIONS_CACHE_TTL_MS,
  );
}
