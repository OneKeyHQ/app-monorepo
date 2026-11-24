import {
  perpsActiveAssetAtom,
  perpsActiveAssetCtxAtom,
  perpsActiveAssetDataAtom,
  spotActiveAssetAtom,
  spotActiveAssetCtxAtom,
  tradingModeAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export const PERPS_MARKET_DATA_STALE_MS = 5000;

export type IPerpsMarketDataFreshnessReason =
  | 'ready'
  | 'socket_not_open'
  | 'network_disconnected'
  | 'no_message'
  | 'stale'
  | 'other_market';

export type IPerpsMarketDataFreshness = {
  isReady: boolean;
  isStale: boolean;
  reason: IPerpsMarketDataFreshnessReason;
  ageMs: number | undefined;
  lastMessageAt: number | null;
};

export function getPerpsMarketDataFreshness({
  isWebSocketConnected,
  networkConnected,
  lastMessageAt,
  nowMs = Date.now(),
  staleMs = PERPS_MARKET_DATA_STALE_MS,
}: {
  isWebSocketConnected: boolean;
  networkConnected: boolean | undefined;
  lastMessageAt: number | null | undefined;
  nowMs?: number;
  staleMs?: number;
}): IPerpsMarketDataFreshness {
  const normalizedLastMessageAt = lastMessageAt ?? null;

  if (networkConnected === false) {
    return {
      isReady: false,
      isStale: true,
      reason: 'network_disconnected',
      ageMs: normalizedLastMessageAt
        ? Math.max(0, nowMs - normalizedLastMessageAt)
        : undefined,
      lastMessageAt: normalizedLastMessageAt,
    };
  }

  if (!isWebSocketConnected) {
    return {
      isReady: false,
      isStale: true,
      reason: 'socket_not_open',
      ageMs: undefined,
      lastMessageAt: normalizedLastMessageAt,
    };
  }

  if (!normalizedLastMessageAt) {
    return {
      isReady: false,
      isStale: true,
      reason: 'no_message',
      ageMs: undefined,
      lastMessageAt: null,
    };
  }

  const ageMs = Math.max(0, nowMs - normalizedLastMessageAt);
  if (ageMs > staleMs) {
    return {
      isReady: false,
      isStale: true,
      reason: 'stale',
      ageMs,
      lastMessageAt: normalizedLastMessageAt,
    };
  }

  return {
    isReady: true,
    isStale: false,
    reason: 'ready',
    ageMs,
    lastMessageAt: normalizedLastMessageAt,
  };
}

/**
 * Whether the market the background holds is the token on the page. The
 * order form trades on that market's data, i.e. its price, its sizes and its
 * leverage, and another page can have moved the market on, e.g. an extension
 * tab, while this page still shows its own token.
 */
export function isPerpsMarketOfInstrument({
  instrument,
  mode,
  perpCoin,
  spotCoin,
}: {
  /** The token on the page. */
  instrument: { mode: 'perp' | 'spot'; coin: string };
  /** The market the background holds. */
  mode: 'perp' | 'spot' | undefined;
  perpCoin: string | undefined;
  spotCoin: string | undefined;
}): boolean {
  const marketMode = mode ?? 'perp';
  const marketCoin = marketMode === 'spot' ? spotCoin : perpCoin;
  return (
    Boolean(instrument.coin) &&
    instrument.mode === marketMode &&
    instrument.coin === marketCoin
  );
}

/**
 * The same as the atoms hold it at the moment an order is confirmed, checked
 * down to what the order is built from: the asset, the quote and the data its
 * sizes are computed from must all be the page's token's.
 */
export async function isPerpsOrderFormDataOfInstrument(instrument: {
  mode: 'perp' | 'spot';
  coin: string;
  assetId: number | undefined;
}): Promise<boolean> {
  const [mode, perpAsset, spotAsset, perpCtx, spotCtx, assetData] =
    await Promise.all([
      tradingModeAtom.get(),
      perpsActiveAssetAtom.get(),
      spotActiveAssetAtom.get(),
      perpsActiveAssetCtxAtom.get(),
      spotActiveAssetCtxAtom.get(),
      perpsActiveAssetDataAtom.get(),
    ]);
  const market = instrument.mode === 'spot' ? spotAsset : perpAsset;
  const quote = instrument.mode === 'spot' ? spotCtx : perpCtx;
  return (
    isPerpsMarketOfInstrument({
      instrument,
      mode,
      perpCoin: perpAsset?.coin,
      spotCoin: spotAsset?.coin,
    }) &&
    market?.assetId === instrument.assetId &&
    // Without a quote the form prices from the mids, which go by coin.
    (!quote || quote.coin === instrument.coin) &&
    (instrument.mode === 'spot' ||
      !assetData ||
      assetData.coin === instrument.coin)
  );
}

/**
 * For the order form: market data that is another token's than the page's
 * is none to trade on, however fresh.
 */
export function withPerpsMarketOfInstrument(
  freshness: IPerpsMarketDataFreshness,
  isMarketOfInstrument: boolean,
): IPerpsMarketDataFreshness {
  if (isMarketOfInstrument || !freshness.isReady) return freshness;
  return { ...freshness, isReady: false, reason: 'other_market' };
}

/** What to tell the user whose order the market data holds back. */
export function getPerpsMarketDataBlockedMessageIds(
  freshness: IPerpsMarketDataFreshness,
): { title: ETranslations; message?: ETranslations } {
  if (freshness.reason === 'other_market') {
    return { title: ETranslations.target_market_data_changed__msg };
  }
  return {
    title: ETranslations.perp_offline,
    message: ETranslations.perps_offline_moblie,
  };
}

export function shouldNotifyPerpsNetworkIssue(
  freshness: IPerpsMarketDataFreshness,
) {
  return (
    freshness.reason === 'network_disconnected' || freshness.reason === 'stale'
  );
}

export function shouldBlockPerpsTradingForMarketData(
  freshness: IPerpsMarketDataFreshness,
) {
  return !freshness.isReady;
}
