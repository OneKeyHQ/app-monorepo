/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import type {
  IMarketHomePreferences,
  IMarketSelectedTabAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useMarketHomeSelection } from '../hooks/useMarketHomeSelection';

import { useMarketSubCategorySelection } from './useMarketSubCategorySelection';

import type { IMarketCategoryItem } from '../types';

const ALL: IMarketCategoryItem = { id: 'all', name: 'All' };
const CHAINS: IMarketCategoryItem = {
  id: 'market_l1_l2_chains',
  name: 'L1 / L2',
};
const DEFI: IMarketCategoryItem = {
  id: 'market_defi_and_infra',
  name: 'DeFi',
};

let mockSelection: IMarketSelectedTabAtom;
let mockPreferences: IMarketHomePreferences;
let mockBackgroundPreferences: IMarketHomePreferences;
let mockEchoWrites: boolean;
const mockListeners = new Set<() => void>();
const mockSetPreferences = jest.fn(
  (update: (prev: IMarketHomePreferences) => IMarketHomePreferences) => {
    if (mockEchoWrites) {
      mockPreferences = update(mockPreferences);
      mockListeners.forEach((listener) => listener());
    }
  },
);
const mockUpdatePreferences = jest.fn(
  async (update: IMarketHomePreferences) => {
    mockBackgroundPreferences = { ...mockBackgroundPreferences, ...update };
  },
);

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  serviceMarketV2: {
    updateMarketHomePreferences: (update: IMarketHomePreferences) =>
      mockUpdatePreferences(update),
  },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  isNativeMainThread: false,
  enableNativeBackgroundThread: true,
  isExtensionUi: false,
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useMarketSelectedTabAtom: () => [mockSelection],
    useMarketHomePreferencesAtom: () => [
      React.useSyncExternalStore(
        (listener) => {
          mockListeners.add(listener);
          return () => mockListeners.delete(listener);
        },
        () => mockPreferences,
      ),
      mockSetPreferences,
    ],
  };
});

beforeEach(() => {
  jest.restoreAllMocks();
  mockSelection = { tab: 'trending' };
  mockPreferences = {};
  mockBackgroundPreferences = {};
  mockEchoWrites = true;
  mockSetPreferences.mockClear();
  mockUpdatePreferences.mockClear();
});

describe('useMarketSubCategorySelection', () => {
  it('defaults to all before and after the config loads', () => {
    const { result, rerender } = renderHook(
      ({ categories }) =>
        useMarketSubCategorySelection(
          categories,
          'selectedTopCoinsCategory',
          false,
        ),
      { initialProps: { categories: [] as IMarketCategoryItem[] } },
    );
    expect(result.current[0]).toBe('all');

    rerender({ categories: [ALL, CHAINS, DEFI] });
    expect(result.current[0]).toBe('all');
  });

  it('falls back to the first category when the config has no all', () => {
    const { result } = renderHook(() =>
      useMarketSubCategorySelection(
        [CHAINS, DEFI],
        'selectedTopCoinsCategory',
        false,
      ),
    );
    expect(result.current[0]).toBe('market_l1_l2_chains');
  });

  it('keeps a selection that is still configured and resets a removed one', () => {
    const { result, rerender } = renderHook(
      ({ categories }) =>
        useMarketSubCategorySelection(
          categories,
          'selectedTopCoinsCategory',
          false,
        ),
      { initialProps: { categories: [ALL, CHAINS, DEFI] } },
    );
    act(() => result.current[1]('market_defi_and_infra'));
    expect(result.current[0]).toBe('market_defi_and_infra');

    rerender({ categories: [ALL, DEFI] });
    expect(result.current[0]).toBe('market_defi_and_infra');

    rerender({ categories: [ALL, CHAINS] });
    expect(result.current[0]).toBe('all');

    act(() => result.current[1]('market_l1_l2_chains'));
    rerender({ categories: [] });
    expect(result.current[0]).toBe('market_l1_l2_chains');
  });

  it('restores a saved category while waiting for config without overwriting it', () => {
    mockSelection.selectedTopCoinsCategory = DEFI.id;
    const { result, rerender } = renderHook(
      ({ categories, isLoading }) =>
        useMarketSubCategorySelection(
          categories,
          'selectedTopCoinsCategory',
          isLoading,
        ),
      {
        initialProps: {
          categories: [] as IMarketCategoryItem[],
          isLoading: true,
        },
      },
    );

    expect(result.current[0]).toBe(DEFI.id);
    rerender({ categories: [ALL, CHAINS], isLoading: true });
    expect(result.current[0]).toBe(DEFI.id);
    expect(mockSetPreferences).not.toHaveBeenCalled();

    rerender({ categories: [ALL, CHAINS, DEFI], isLoading: false });
    expect(result.current[0]).toBe(DEFI.id);
    expect(mockSetPreferences).not.toHaveBeenCalled();
  });

  it('persists the fallback only after config confirms a category was removed', () => {
    mockSelection.selectedTopCoinsCategory = DEFI.id;
    const { result, rerender } = renderHook(
      ({ isLoading }) =>
        useMarketSubCategorySelection(
          [ALL, CHAINS],
          'selectedTopCoinsCategory',
          isLoading,
        ),
      { initialProps: { isLoading: true } },
    );
    expect(result.current[0]).toBe(DEFI.id);

    rerender({ isLoading: false });
    expect(result.current[0]).toBe(ALL.id);
    expect(mockPreferences.selectedTopCoinsCategory).toBe(ALL.id);
  });

  it('uses the hydrated category immediately when config arrives in the same render', () => {
    const { result, rerender } = renderHook(
      ({ categories, isLoading }) =>
        useMarketSubCategorySelection(
          categories,
          'selectedTopCoinsCategory',
          isLoading,
        ),
      {
        initialProps: {
          categories: [] as IMarketCategoryItem[],
          isLoading: true,
        },
      },
    );
    expect(result.current[0]).toBe(ALL.id);

    act(() => {
      mockPreferences = {
        ...mockPreferences,
        selectedTopCoinsCategory: DEFI.id,
      };
      rerender({ categories: [CHAINS, DEFI], isLoading: false });
    });
    expect(result.current[0]).toBe(DEFI.id);
    expect(mockSetPreferences).not.toHaveBeenCalled();
  });

  it('restores independently saved stock and top coin selections after remounting', () => {
    mockSelection.selectedSpotCategory = 'topCoins';
    const renderSelections = () =>
      renderHook(() => ({
        stocks: useMarketSubCategorySelection(
          [ALL, CHAINS, DEFI],
          'selectedStockCategory',
          false,
        ),
        topCoins: useMarketSubCategorySelection(
          [ALL, CHAINS, DEFI],
          'selectedTopCoinsCategory',
          false,
        ),
      }));
    const first = renderSelections();
    act(() => {
      first.result.current.stocks[1](CHAINS.id);
      first.result.current.topCoins[1](DEFI.id);
    });
    first.unmount();

    const restored = renderSelections();
    expect(restored.result.current.stocks[0]).toBe(CHAINS.id);
    expect(restored.result.current.topCoins[0]).toBe(DEFI.id);
    expect(mockSelection.selectedSpotCategory).toBe('topCoins');
  });
});

describe('useMarketHomeSelection', () => {
  it('restores network, time range and Favorites filter after remounting', () => {
    const renderSelections = () =>
      renderHook(() => ({
        network: useMarketHomeSelection('selectedNetworkId', 'onekeyall--0'),
        timeRange: useMarketHomeSelection('timeRange', '1h'),
        watchlist: useMarketHomeSelection('watchlistFilter', 'all'),
      }));
    const first = renderSelections();
    act(() => {
      first.result.current.network[1]('evm--1');
      first.result.current.timeRange[1]('24h');
      first.result.current.watchlist[1]('stocks');
    });
    first.unmount();

    const restored = renderSelections();
    expect(restored.result.current.network[0]).toBe('evm--1');
    expect(restored.result.current.timeRange[0]).toBe('24h');
    expect(restored.result.current.watchlist[0]).toBe('stocks');
  });

  it('applies a saved selection hydrated after the component mounts', () => {
    const { result } = renderHook(() =>
      useMarketHomeSelection('timeRange', '1h'),
    );
    expect(result.current[0]).toBe('1h');
    act(() => {
      mockPreferences = { ...mockPreferences, timeRange: '4h' };
      mockListeners.forEach((listener) => listener());
    });
    expect(result.current[0]).toBe('4h');
    expect(mockSetPreferences).not.toHaveBeenCalled();
  });

  it('keeps the latest local selection while older bg echoes arrive', () => {
    mockEchoWrites = false;
    const { result } = renderHook(() =>
      useMarketHomeSelection('timeRange', '1h'),
    );
    act(() => result.current[1]('4h'));
    act(() => result.current[1]('24h'));

    act(() => {
      mockPreferences = { ...mockPreferences, timeRange: '4h' };
      mockListeners.forEach((listener) => listener());
    });
    expect(result.current[0]).toBe('24h');

    act(() => {
      mockPreferences = { ...mockPreferences, timeRange: '24h' };
      mockListeners.forEach((listener) => listener());
    });
    expect(result.current[0]).toBe('24h');
  });

  it('merges rapid native changes in bg while the UI mirror still has the old preferences', () => {
    jest.replaceProperty(platformEnv, 'isNativeMainThread', true);
    mockPreferences = { timeRange: '1h', selectedNetworkId: 'onekeyall--0' };
    mockBackgroundPreferences = { ...mockPreferences };
    const { result } = renderHook(() => ({
      network: useMarketHomeSelection('selectedNetworkId', 'onekeyall--0'),
      timeRange: useMarketHomeSelection('timeRange', '1h'),
    }));

    act(() => {
      result.current.timeRange[1]('24h');
      result.current.network[1]('evm--1');
    });

    expect(mockUpdatePreferences.mock.calls).toEqual([
      [{ timeRange: '24h' }],
      [{ selectedNetworkId: 'evm--1' }],
    ]);
    expect(mockSetPreferences).not.toHaveBeenCalled();
    expect(mockBackgroundPreferences).toEqual({
      timeRange: '24h',
      selectedNetworkId: 'evm--1',
    });
    expect(mockPreferences).toEqual({
      timeRange: '1h',
      selectedNetworkId: 'onekeyall--0',
    });

    act(() => {
      mockPreferences = { ...mockBackgroundPreferences };
      mockListeners.forEach((listener) => listener());
    });
    expect(result.current.timeRange[0]).toBe('24h');
    expect(result.current.network[0]).toBe('evm--1');
  });
});
