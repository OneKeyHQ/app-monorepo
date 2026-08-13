import type { IMarketTradingViewSubIndicatorCountPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/market';

import {
  getMarketTradingViewStorageNamespace,
  getMarketTradingViewSubIndicatorCount,
  setMarketTradingViewStorageNamespace,
  setMarketTradingViewSubIndicatorCount,
} from './marketTradingViewSubIndicatorCount';

describe('market TradingView sub-indicator count persistence', () => {
  it('keeps regular Market and Hyperliquid layout counts independent', () => {
    const initialState: IMarketTradingViewSubIndicatorCountPersistAtom = {
      subIndicatorCountByStorageNamespace: {},
      storageNamespaceByChartKey: {},
    };
    const marketState = setMarketTradingViewSubIndicatorCount({
      count: 1,
      persistState: initialState,
      storageNamespace: 'market',
    });
    const finalState = setMarketTradingViewSubIndicatorCount({
      count: 3,
      persistState: marketState,
      storageNamespace: 'market-hyperliquid',
    });

    expect(
      getMarketTradingViewSubIndicatorCount({
        persistState: finalState,
        storageNamespace: 'market',
      }),
    ).toBe(1);
    expect(
      getMarketTradingViewSubIndicatorCount({
        persistState: finalState,
        storageNamespace: 'market-hyperliquid',
      }),
    ).toBe(3);
  });

  it('preserves state identity when the stored count is unchanged', () => {
    const persistState: IMarketTradingViewSubIndicatorCountPersistAtom = {
      subIndicatorCountByStorageNamespace: { market: 2 },
      storageNamespaceByChartKey: {},
    };

    expect(
      setMarketTradingViewSubIndicatorCount({
        count: 2,
        persistState,
        storageNamespace: 'market',
      }),
    ).toBe(persistState);
  });

  it('uses the persisted chart namespace while source detection is loading', () => {
    const chartKey = 'v2:btc:btc:BTC';
    const initialState: IMarketTradingViewSubIndicatorCountPersistAtom = {
      subIndicatorCountByStorageNamespace: {},
      storageNamespaceByChartKey: {},
    };
    const persistState = setMarketTradingViewStorageNamespace({
      chartKey,
      persistState: initialState,
      storageNamespace: 'market-hyperliquid',
    });

    expect(
      getMarketTradingViewStorageNamespace({
        chartKey,
        detectedStorageNamespace: 'market',
        isSourceLoading: true,
        persistState,
      }),
    ).toBe('market-hyperliquid');
    expect(
      getMarketTradingViewStorageNamespace({
        chartKey,
        detectedStorageNamespace: 'market',
        isSourceLoading: false,
        persistState,
      }),
    ).toBe('market');

    const regularMarketState = setMarketTradingViewStorageNamespace({
      chartKey,
      persistState,
      storageNamespace: 'market',
    });
    expect(
      regularMarketState.storageNamespaceByChartKey[chartKey],
    ).toBeUndefined();
  });
});
