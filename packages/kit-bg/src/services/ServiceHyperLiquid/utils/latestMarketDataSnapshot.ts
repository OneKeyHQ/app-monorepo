import type {
  IBook,
  IWsAllDexsAssetCtxs,
} from '@onekeyhq/shared/types/hyperliquid/sdk';

export interface ILatestPerpsMarketDataPayload<T> {
  data: T;
  updatedAt: number;
}

export interface ILatestPerpsMarketDataSnapshot {
  allDexsAssetCtxs?: ILatestPerpsMarketDataPayload<IWsAllDexsAssetCtxs>;
  l2Book?: ILatestPerpsMarketDataPayload<IBook>;
}

export function filterFreshPerpsMarketDataSnapshot({
  snapshot,
  coin,
  maxAgeMs,
  now,
}: {
  snapshot: ILatestPerpsMarketDataSnapshot;
  coin?: string;
  maxAgeMs: number;
  now: number;
}): ILatestPerpsMarketDataSnapshot {
  const isFresh = (updatedAt: number) => now - updatedAt <= maxAgeMs;
  const next: ILatestPerpsMarketDataSnapshot = {};

  if (
    snapshot.allDexsAssetCtxs &&
    isFresh(snapshot.allDexsAssetCtxs.updatedAt)
  ) {
    next.allDexsAssetCtxs = snapshot.allDexsAssetCtxs;
  }

  const requestedCoin = coin?.trim();
  if (
    requestedCoin &&
    snapshot.l2Book &&
    snapshot.l2Book.data.coin === requestedCoin &&
    isFresh(snapshot.l2Book.updatedAt)
  ) {
    next.l2Book = snapshot.l2Book;
  }

  return next;
}
