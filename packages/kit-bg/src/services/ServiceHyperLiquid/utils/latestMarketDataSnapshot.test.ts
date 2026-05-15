import type {
  IBook,
  IWsAllDexsAssetCtxs,
} from '@onekeyhq/shared/types/hyperliquid/sdk';

import { filterFreshPerpsMarketDataSnapshot } from './latestMarketDataSnapshot';

describe('filterFreshPerpsMarketDataSnapshot', () => {
  const allDexsAssetCtxs = {
    ctxs: [['', []]],
  } as unknown as IWsAllDexsAssetCtxs;

  const btcBook = {
    coin: 'BTC',
    levels: [[], []],
    time: 1,
  } as unknown as IBook;

  it('returns fresh global asset ctxs and matching L2 book', () => {
    const snapshot = filterFreshPerpsMarketDataSnapshot({
      snapshot: {
        allDexsAssetCtxs: { data: allDexsAssetCtxs, updatedAt: 1000 },
        l2Book: { data: btcBook, updatedAt: 1100 },
      },
      coin: 'BTC',
      maxAgeMs: 1000,
      now: 1500,
    });

    expect(snapshot.allDexsAssetCtxs?.data).toBe(allDexsAssetCtxs);
    expect(snapshot.l2Book?.data).toBe(btcBook);
  });

  it('does not replay a book for a different active coin', () => {
    const snapshot = filterFreshPerpsMarketDataSnapshot({
      snapshot: {
        allDexsAssetCtxs: { data: allDexsAssetCtxs, updatedAt: 1000 },
        l2Book: { data: btcBook, updatedAt: 1100 },
      },
      coin: 'ETH',
      maxAgeMs: 1000,
      now: 1500,
    });

    expect(snapshot.allDexsAssetCtxs?.data).toBe(allDexsAssetCtxs);
    expect(snapshot.l2Book).toBeUndefined();
  });

  it('drops stale market snapshots', () => {
    const snapshot = filterFreshPerpsMarketDataSnapshot({
      snapshot: {
        allDexsAssetCtxs: { data: allDexsAssetCtxs, updatedAt: 1000 },
        l2Book: { data: btcBook, updatedAt: 1000 },
      },
      coin: 'BTC',
      maxAgeMs: 1000,
      now: 2001,
    });

    expect(snapshot).toEqual({});
  });
});
