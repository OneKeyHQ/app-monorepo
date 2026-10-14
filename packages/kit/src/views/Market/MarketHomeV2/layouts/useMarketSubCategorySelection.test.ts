/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import type {
  IMarketHomePreferences,
  IMarketHomePreferencesAtom,
  IMarketSelectedTabAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { createPromiseTarget } from '@onekeyhq/shared/src/utils/promiseUtils';

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
let mockPreferences: IMarketHomePreferencesAtom;
let mockBackgroundPreferences: IMarketHomePreferencesAtom;
let mockEchoWrites: boolean;
const mockListeners = new Set<() => void>();
const mockSetPreferences = jest.fn(
  (
    update: (prev: IMarketHomePreferencesAtom) => IMarketHomePreferencesAtom,
  ) => {
    if (mockEchoWrites) {
      mockPreferences = update(mockPreferences);
      mockListeners.forEach((listener) => listener());
    }
  },
);
const mockUpdatePreferences = jest.fn(
  async (update: IMarketHomePreferences) => {
    mockBackgroundPreferences = { ...mockBackgroundPreferences, ...update };
    mockBackgroundPreferences.revision =
      (mockBackgroundPreferences.revision ?? 0) + 1;
    return mockBackgroundPreferences.revision;
  },
);
const mockLogError = jest.fn<void, [string]>();

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: { error: { log: (message: string) => mockLogError(message) } },
  },
}));

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
  mockLogError.mockClear();
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

  it('keeps a selection that is still configured and resets a removed one', async () => {
    const { result, rerender } = renderHook(
      ({ categories }) =>
        useMarketSubCategorySelection(
          categories,
          'selectedTopCoinsCategory',
          false,
        ),
      { initialProps: { categories: [ALL, CHAINS, DEFI] } },
    );
    await act(async () => result.current[1]('market_defi_and_infra'));
    expect(result.current[0]).toBe('market_defi_and_infra');

    rerender({ categories: [ALL, DEFI] });
    expect(result.current[0]).toBe('market_defi_and_infra');

    await act(async () => rerender({ categories: [ALL, CHAINS] }));
    expect(result.current[0]).toBe('all');

    await act(async () => result.current[1]('market_l1_l2_chains'));
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

  it('persists the fallback only after config confirms a category was removed', async () => {
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

    await act(async () => rerender({ isLoading: false }));
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

  it('restores independently saved stock and top coin selections after remounting', async () => {
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
    await act(async () => {
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
  it('restores network, time range and Favorites filter after remounting', async () => {
    const renderSelections = () =>
      renderHook(() => ({
        network: useMarketHomeSelection('selectedNetworkId', 'onekeyall--0'),
        timeRange: useMarketHomeSelection('timeRange', '1h'),
        watchlist: useMarketHomeSelection('watchlistFilter', 'all'),
      }));
    const first = renderSelections();
    await act(async () => {
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

  it('keeps the latest local selection while older bg echoes arrive', async () => {
    jest.replaceProperty(platformEnv, 'isNativeMainThread', true);
    const olderRequest = createPromiseTarget<number>();
    const latestRequest = createPromiseTarget<number>();
    mockUpdatePreferences
      .mockImplementationOnce(() => olderRequest.ready)
      .mockImplementationOnce(() => latestRequest.ready);
    const { result } = renderHook(() =>
      useMarketHomeSelection('timeRange', '1h'),
    );
    act(() => result.current[1]('4h'));
    act(() => result.current[1]('24h'));

    act(() => {
      mockPreferences = { ...mockPreferences, timeRange: '4h', revision: 1 };
      mockListeners.forEach((listener) => listener());
    });
    expect(result.current[0]).toBe('24h');

    act(() => {
      mockPreferences = { ...mockPreferences, timeRange: '24h', revision: 2 };
      mockListeners.forEach((listener) => listener());
    });
    expect(result.current[0]).toBe('24h');
    await act(async () => {
      olderRequest.resolveTarget(1);
      latestRequest.resolveTarget(2);
      await Promise.all([olderRequest.ready, latestRequest.ready]);
    });
  });

  it('merges rapid native changes in bg while the UI mirror still has the old preferences', async () => {
    jest.replaceProperty(platformEnv, 'isNativeMainThread', true);
    mockPreferences = { timeRange: '1h', selectedNetworkId: 'onekeyall--0' };
    mockBackgroundPreferences = { ...mockPreferences };
    const { result } = renderHook(() => ({
      network: useMarketHomeSelection('selectedNetworkId', 'onekeyall--0'),
      timeRange: useMarketHomeSelection('timeRange', '1h'),
    }));

    await act(async () => {
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
      revision: 2,
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

  it("accepts another extension window's newer value when its own echo was coalesced", async () => {
    jest.replaceProperty(platformEnv, 'isExtensionUi', true);
    mockPreferences = { timeRange: '1h', revision: 0 };
    const request = createPromiseTarget<number>();
    mockUpdatePreferences.mockImplementationOnce(() => request.ready);
    const { result } = renderHook(() =>
      useMarketHomeSelection('timeRange', '1h'),
    );
    act(() => result.current[1]('4h'));
    act(() => {
      mockPreferences = { timeRange: '24h', revision: 2 };
      mockListeners.forEach((listener) => listener());
    });
    expect(result.current[0]).toBe('4h');

    await act(async () => {
      request.resolveTarget(1);
      await request.ready;
    });
    expect(result.current[0]).toBe('24h');
    act(() => {
      mockPreferences = { timeRange: '5m', revision: 3 };
      mockListeners.forEach((listener) => listener());
    });
    expect(result.current[0]).toBe('5m');
  });

  it('keeps the newest native selection until its acknowledged revision arrives', async () => {
    jest.replaceProperty(platformEnv, 'isNativeMainThread', true);
    mockPreferences = { timeRange: '1h', revision: 0 };
    const olderRequest = createPromiseTarget<number>();
    const latestRequest = createPromiseTarget<number>();
    mockUpdatePreferences
      .mockImplementationOnce(() => olderRequest.ready)
      .mockImplementationOnce(() => latestRequest.ready);
    const { result } = renderHook(() =>
      useMarketHomeSelection('timeRange', '1h'),
    );
    act(() => {
      result.current[1]('4h');
      result.current[1]('24h');
    });
    await act(async () => {
      olderRequest.resolveTarget(1);
      latestRequest.resolveTarget(2);
      await Promise.all([olderRequest.ready, latestRequest.ready]);
    });
    expect(result.current[0]).toBe('24h');
    act(() => {
      mockPreferences = { timeRange: '4h', revision: 1 };
      mockListeners.forEach((listener) => listener());
    });
    expect(result.current[0]).toBe('24h');
    act(() => {
      mockPreferences = { timeRange: '24h', revision: 2 };
      mockListeners.forEach((listener) => listener());
    });
    expect(result.current[0]).toBe('24h');
  });

  it('handles a Travel Mode rejection as a session-only choice and accepts later authoritative updates', async () => {
    jest.replaceProperty(platformEnv, 'isNativeMainThread', true);
    mockPreferences = { timeRange: '1h', revision: 0 };
    mockUpdatePreferences.mockRejectedValueOnce(
      new Error('Travel Mode command rejected'),
    );
    const { result, unmount } = renderHook(() =>
      useMarketHomeSelection('timeRange', '1h'),
    );
    await act(async () => result.current[1]('4h'));
    expect(result.current[0]).toBe('4h');
    expect(mockLogError).toHaveBeenCalledTimes(1);
    expect(mockPreferences.timeRange).toBe('1h');
    act(() => {
      mockPreferences = { timeRange: '24h', revision: 1 };
      mockListeners.forEach((listener) => listener());
    });
    expect(result.current[0]).toBe('24h');
    unmount();
    const restored = renderHook(() =>
      useMarketHomeSelection('timeRange', '1h'),
    );
    expect(restored.result.current[0]).toBe('24h');
  });

  it('does not let an older failed write replace a newer pending choice', async () => {
    jest.replaceProperty(platformEnv, 'isExtensionUi', true);
    const olderRequest = createPromiseTarget<number>();
    const latestRequest = createPromiseTarget<number>();
    mockUpdatePreferences
      .mockImplementationOnce(() => olderRequest.ready)
      .mockImplementationOnce(() => latestRequest.ready);
    const { result } = renderHook(() =>
      useMarketHomeSelection('timeRange', '1h'),
    );
    act(() => {
      result.current[1]('4h');
      result.current[1]('24h');
    });
    await act(async () => {
      olderRequest.rejectTarget(new Error('stale failure'));
      await olderRequest.ready.catch(() => undefined);
    });
    expect(result.current[0]).toBe('24h');
    expect(mockLogError).not.toHaveBeenCalled();
    await act(async () => {
      mockPreferences = { timeRange: '24h', revision: 2 };
      mockListeners.forEach((listener) => listener());
      latestRequest.resolveTarget(2);
      await latestRequest.ready;
    });
    expect(result.current[0]).toBe('24h');
  });
});
