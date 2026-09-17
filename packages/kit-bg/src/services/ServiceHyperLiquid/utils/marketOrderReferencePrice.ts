import {
  getValidPerpsPrice,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IWsAllMids } from '@onekeyhq/shared/types/hyperliquid/sdk';

export const PERPS_MARKET_ORDER_REFERENCE_PRICE_STALE_MS = 5000;

// The cache is fed by the WebSocket allMids stream, which carries every dex;
// the REST fallback returns a single dex, so it is queried by the coin's dex.
export async function resolveMarketOrderReferencePrice({
  coin,
  cachedAllMids,
  cachedAt,
  nowMs = Date.now(),
  loadAllMids,
}: {
  coin: string;
  cachedAllMids: IWsAllMids | undefined;
  cachedAt: number;
  nowMs?: number;
  loadAllMids: (dex: string) => Promise<Record<string, string>>;
}): Promise<string | undefined> {
  if (!coin) {
    return undefined;
  }

  const cacheAgeMs = Math.max(0, nowMs - cachedAt);
  if (
    cachedAllMids &&
    cachedAt > 0 &&
    cacheAgeMs <= PERPS_MARKET_ORDER_REFERENCE_PRICE_STALE_MS
  ) {
    const cachedPrice = getValidPerpsPrice(cachedAllMids.mids?.[coin]);
    if (cachedPrice) {
      return cachedPrice;
    }
  }

  const freshAllMids = await loadAllMids(parseDexCoin(coin).dexLabel ?? '');
  return getValidPerpsPrice(freshAllMids[coin]);
}
