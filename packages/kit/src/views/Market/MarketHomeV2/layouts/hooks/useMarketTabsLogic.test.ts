/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import type { IMarketSelectedTabAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useMarketTabsLogic } from './useMarketTabsLogic';

let mockSelection: IMarketSelectedTabAtom;
const mockListeners = new Set<() => void>();
const mockSetSelection = jest.fn(
  (_update: (prev: IMarketSelectedTabAtom) => IMarketSelectedTabAtom) => {},
);

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/hooks/usePerpTabConfig', () => ({
  usePerpTabConfig: () => ({ perpDisabled: false }),
}));
jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: {
    getRuntimeEnvironmentSync: () => ({ profile: { kind: 'standard' } }),
  },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useMarketSelectedTabAtom: () => [
      React.useSyncExternalStore(
        (listener) => {
          mockListeners.add(listener);
          return () => mockListeners.delete(listener);
        },
        () => mockSelection,
      ),
      mockSetSelection,
    ],
  };
});

beforeEach(() => {
  mockSelection = { tab: 'watchlist', selectedSpotCategory: 'trending' };
  mockSetSelection.mockClear();
});

describe('market tab presses before the background echo', () => {
  it('persists returning to the original tab while the previous press is in flight', () => {
    const onTabChange = jest.fn();
    const { result } = renderHook(() => useMarketTabsLogic(onTabChange));

    act(() => {
      result.current.handleTabChange(ETranslations.global_perp);
      result.current.handleTabChange(ETranslations.global_favorites);
    });

    expect(mockSetSelection).toHaveBeenCalledTimes(2);
    let backgroundSelection = { ...mockSelection };
    for (const [update] of mockSetSelection.mock.calls) {
      backgroundSelection = update(backgroundSelection);
    }
    expect(backgroundSelection.tab).toBe('watchlist');
    expect(onTabChange.mock.calls).toEqual([['perps'], ['watchlist']]);
  });

  it('persists returning to the original spot category before its mirror changes', () => {
    mockSelection = { tab: 'trending', selectedSpotCategory: 'trending' };
    const onSpotCategoryChange = jest.fn();
    const { result } = renderHook(() =>
      useMarketTabsLogic(jest.fn(), {
        spotCategories: [
          { id: 'trending', name: 'Trending' },
          { id: 'stocks', name: 'Stocks' },
        ],
        selectedSpotCategory: 'trending',
        onSpotCategoryChange,
      }),
    );

    act(() => {
      result.current.handleTabChange('Stocks');
      result.current.handleTabChange('Trending');
    });

    expect(mockSetSelection).toHaveBeenCalledTimes(2);
    expect(onSpotCategoryChange.mock.calls).toEqual([['stocks'], ['trending']]);
    const lastUpdate = mockSetSelection.mock.calls[1][0];
    expect(lastUpdate(mockSelection).selectedSpotCategory).toBe('trending');
  });

  it('deduplicates callbacks for the latest pending press', () => {
    const { result } = renderHook(() => useMarketTabsLogic(jest.fn()));
    act(() => {
      result.current.handleTabChange(ETranslations.global_perp);
      result.current.handleTabChange(ETranslations.global_perp);
    });
    expect(mockSetSelection).toHaveBeenCalledTimes(1);
  });

  it('uses the mirror again after the local selection has been confirmed', () => {
    const { result } = renderHook(() => useMarketTabsLogic(jest.fn()));
    act(() => result.current.handleTabChange(ETranslations.global_perp));
    act(() => {
      mockSelection = { ...mockSelection, tab: 'perps' };
      mockListeners.forEach((listener) => listener());
    });
    expect(result.current.isTabSelectionInFlight()).toBe(false);
    act(() => {
      mockSelection = { ...mockSelection, tab: 'watchlist' };
      mockListeners.forEach((listener) => listener());
    });
    act(() => result.current.handleTabChange(ETranslations.global_perp));
    expect(mockSetSelection).toHaveBeenCalledTimes(2);
  });
});
