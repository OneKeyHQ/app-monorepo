/** @jest-environment jsdom */

import { renderHook, waitFor } from '@testing-library/react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { usePerpsFavorites } from './usePerpsFavorites';

let mockFavorites: string[] = [];

jest.mock('@onekeyhq/components', () => ({
  ...jest.requireActual<
    typeof import('../../../../../components/src/hooks/useDeferredPromise')
  >('../../../../../components/src/hooks/useDeferredPromise'),
  getCurrentVisibilityState: () => true,
  onVisibilityStateChange: () => () => {},
  useNetInfo: () => ({ isRawInternetReachable: true }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => true,
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useActiveTradeInstrumentAtom: () => [{ mode: 'perp' }],
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpTokenFavoritesPersistAtom: () => [{ favorites: mockFavorites }],
  useSpotTokenFavoritesPersistAtom: () => [{ favorites: mockFavorites }],
  usePerpsFavoritesOrderPersistAtom: () => [{ sequence: [] }],
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHyperliquid: {
      getTradingUniverse: jest.fn(async () => ({ universesByDex: [] })),
      refreshTradingMeta: jest.fn(),
      getSpotMeta: jest.fn(async () => ({
        universes: [
          {
            name: '@1',
            baseName: 'BTC',
            quoteName: 'USDC',
            assetId: 10_001,
          },
        ],
      })),
      refreshSpotMeta: jest.fn(),
    },
  },
}));

describe('usePerpsFavorites', () => {
  beforeEach(() => {
    mockFavorites = [];
    jest.clearAllMocks();
  });

  it.each(['spot', 'perp'] as const)(
    'marks empty %s favorites ready without loading metadata',
    async (mode) => {
      const { result } = renderHook(() => usePerpsFavorites({ mode }));
      await waitFor(() =>
        expect(result.current).toEqual({ favoriteItems: [], isReady: true }),
      );
      for (const method of Object.values(
        backgroundApiProxy.serviceHyperliquid,
      )) {
        expect(method).not.toHaveBeenCalled();
      }
    },
  );

  it('retries an interrupted perp metadata read when the initial cache is empty', async () => {
    const asset = {
      name: 'BTC',
      assetId: 0,
      szDecimals: 3,
      maxLeverage: 40,
      marginTableId: 1,
    };
    const populated = { universesByDex: [[asset]], marginTablesMapByDex: [] };
    const getUniverse = jest
      .spyOn(backgroundApiProxy.serviceHyperliquid, 'getTradingUniverse')
      .mockResolvedValueOnce({ universesByDex: [], marginTablesMapByDex: [] })
      .mockRejectedValueOnce(new DOMException('Read interrupted', 'AbortError'))
      .mockResolvedValueOnce(populated)
      .mockResolvedValueOnce(populated);
    const { result, rerender } = renderHook(() =>
      usePerpsFavorites({ mode: 'perp' }),
    );
    await waitFor(() => expect(result.current.isReady).toBe(true));
    mockFavorites = ['BTC'];
    rerender();
    await waitFor(() =>
      expect(result.current.favoriteItems[0]?.coinName).toBe('BTC'),
    );
    expect(getUniverse.mock.calls.length).toBeGreaterThan(2);
  });

  it.each([false, true])(
    'loads the first spot favorite after a transient read failure: %s',
    async (abortFirstRead) => {
      const getSpotMeta = jest.spyOn(
        backgroundApiProxy.serviceHyperliquid,
        'getSpotMeta',
      );
      const { result, rerender } = renderHook(() =>
        usePerpsFavorites({ mode: 'spot' }),
      );
      await waitFor(() => expect(result.current.isReady).toBe(true));

      if (abortFirstRead) {
        getSpotMeta.mockRejectedValueOnce(
          new DOMException('Read interrupted', 'AbortError'),
        );
      }
      mockFavorites = ['@1'];
      rerender();
      expect(result.current.isReady).toBe(false);
      await waitFor(() =>
        expect(result.current).toMatchObject({
          favoriteItems: [{ mode: 'spot', coinName: '@1', assetId: 10_001 }],
          isReady: true,
        }),
      );
      expect(getSpotMeta).toHaveBeenCalledTimes(abortFirstRead ? 2 : 1);
    },
  );
});
