import type { IMarketTradingViewSubIndicatorCountPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/market';

import {
  getMarketTradingViewSubIndicatorCount,
  normalizeMarketTradingViewSubIndicatorCountPersist,
  setMarketTradingViewSubIndicatorCount,
} from './marketTradingViewSubIndicatorCount';

describe('market TradingView sub-indicator count persistence', () => {
  it('persists one shared Market layout count', () => {
    const initialState: IMarketTradingViewSubIndicatorCountPersistAtom = {
      subIndicatorCountByStorageNamespace: {},
    };
    const persistState = setMarketTradingViewSubIndicatorCount({
      count: 1,
      persistState: initialState,
      storageNamespace: 'market',
    });

    expect(
      getMarketTradingViewSubIndicatorCount({
        persistState,
        storageNamespace: 'market',
      }),
    ).toBe(1);
  });

  it('preserves state identity when the stored count is unchanged', () => {
    const persistState: IMarketTradingViewSubIndicatorCountPersistAtom = {
      subIndicatorCountByStorageNamespace: { market: 2 },
    };

    expect(
      setMarketTradingViewSubIndicatorCount({
        count: 2,
        persistState,
        storageNamespace: 'market',
      }),
    ).toBe(persistState);
  });

  it('removes legacy namespaces and chart-key mappings', () => {
    const legacyPersistState = {
      subIndicatorCountByStorageNamespace: {
        market: 2,
        'market-hyperliquid': 4,
      },
      storageNamespaceByChartKey: {
        'v2:btc:btc:BTC': 'market-hyperliquid',
      },
    } as unknown as IMarketTradingViewSubIndicatorCountPersistAtom;

    expect(
      normalizeMarketTradingViewSubIndicatorCountPersist(legacyPersistState),
    ).toEqual({
      subIndicatorCountByStorageNamespace: { market: 2 },
    });
    expect(
      setMarketTradingViewSubIndicatorCount({
        count: 2,
        persistState: legacyPersistState,
        storageNamespace: 'market',
      }),
    ).toEqual({
      subIndicatorCountByStorageNamespace: { market: 2 },
    });
  });
});
