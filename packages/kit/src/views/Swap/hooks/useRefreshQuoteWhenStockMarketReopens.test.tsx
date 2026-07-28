import { act, renderHook } from '@testing-library/react-native';

import { useRefreshQuoteWhenStockMarketReopens } from './useRefreshQuoteWhenStockMarketReopens';

describe('useRefreshQuoteWhenStockMarketReopens', () => {
  it('does not refresh for an initially open Stock market', () => {
    const onRefresh = jest.fn();

    renderHook(() =>
      useRefreshQuoteWhenStockMarketReopens({
        enabled: true,
        marketIsOpen: true,
        onRefresh,
        scopeKey: 'stock-a',
      }),
    );

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('refreshes once after a closed to open transition', () => {
    const onRefresh = jest.fn();
    const { rerender } = renderHook<void, { marketIsOpen: boolean }>(
      ({ marketIsOpen }) =>
        useRefreshQuoteWhenStockMarketReopens({
          enabled: true,
          marketIsOpen,
          onRefresh,
          scopeKey: 'stock-a',
        }),
      {
        initialProps: {
          marketIsOpen: false,
        },
      },
    );

    rerender({ marketIsOpen: true });
    expect(onRefresh).toHaveBeenCalledTimes(1);

    rerender({ marketIsOpen: true });
    expect(onRefresh).toHaveBeenCalledTimes(1);

    rerender({ marketIsOpen: false });
    rerender({ marketIsOpen: true });
    expect(onRefresh).toHaveBeenCalledTimes(2);
  });

  it('does not consume a closed cycle while market status is unavailable', () => {
    const onRefresh = jest.fn();
    const { rerender } = renderHook<
      void,
      { marketIsOpen: boolean | undefined }
    >(
      ({ marketIsOpen }) =>
        useRefreshQuoteWhenStockMarketReopens({
          enabled: true,
          marketIsOpen,
          onRefresh,
          scopeKey: 'stock-a',
        }),
      {
        initialProps: {
          marketIsOpen: false,
        },
      },
    );

    rerender({ marketIsOpen: undefined });
    expect(onRefresh).not.toHaveBeenCalled();

    rerender({ marketIsOpen: true });
    expect(onRefresh).toHaveBeenCalledTimes(1);

    rerender({ marketIsOpen: true });
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('can refresh when the first Market detail is already open', () => {
    const onRefresh = jest.fn();

    const { rerender } = renderHook<void, { enabled: boolean }>(
      ({ enabled }) =>
        useRefreshQuoteWhenStockMarketReopens({
          enabled,
          marketIsOpen: true,
          onRefresh,
          refreshOnInitialOpen: true,
          scopeKey: 'swap-stock-pair',
        }),
      {
        initialProps: {
          enabled: true,
        },
      },
    );

    expect(onRefresh).toHaveBeenCalledTimes(1);

    rerender({ enabled: false });
    rerender({ enabled: true });
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('consumes an open transition when there is no actionable amount', () => {
    const onRefresh = jest.fn();
    const { rerender } = renderHook<
      void,
      { enabled: boolean; marketIsOpen: boolean }
    >(
      ({ enabled, marketIsOpen }) =>
        useRefreshQuoteWhenStockMarketReopens({
          enabled,
          marketIsOpen,
          onRefresh,
          scopeKey: 'stock-a',
        }),
      {
        initialProps: {
          enabled: false,
          marketIsOpen: false,
        },
      },
    );

    rerender({ enabled: false, marketIsOpen: true });
    rerender({ enabled: true, marketIsOpen: true });

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('resets the cycle when the stock scope changes', () => {
    const onRefresh = jest.fn();
    const { rerender } = renderHook<
      void,
      { marketIsOpen: boolean; scopeKey: string }
    >(
      ({ marketIsOpen, scopeKey }) =>
        useRefreshQuoteWhenStockMarketReopens({
          enabled: true,
          marketIsOpen,
          onRefresh,
          refreshOnInitialOpen: true,
          scopeKey,
        }),
      {
        initialProps: {
          marketIsOpen: true,
          scopeKey: 'pair-a',
        },
      },
    );

    expect(onRefresh).toHaveBeenCalledTimes(1);

    act(() => {
      rerender({ marketIsOpen: true, scopeKey: 'pair-b' });
    });
    expect(onRefresh).toHaveBeenCalledTimes(2);
  });

  it('does not refresh while Stock trading is paused', () => {
    const onRefresh = jest.fn();
    const { rerender } = renderHook<
      void,
      { marketDetailFetchedAt: number; marketIsPaused: boolean }
    >(
      ({ marketDetailFetchedAt, marketIsPaused }) =>
        useRefreshQuoteWhenStockMarketReopens({
          enabled: true,
          marketDetailFetchedAt,
          marketIsOpen: true,
          marketIsPaused,
          onRefresh,
          scopeKey: 'stock-a',
        }),
      {
        initialProps: {
          marketDetailFetchedAt: 1,
          marketIsPaused: true,
        },
      },
    );

    expect(onRefresh).not.toHaveBeenCalled();

    rerender({
      marketDetailFetchedAt: 2,
      marketIsPaused: false,
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('retries a current closed quote once per successful open-market poll', () => {
    const onRefresh = jest.fn();
    const { rerender } = renderHook<
      void,
      {
        marketDetailFetchedAt: number;
        refreshOnMarketStatusUpdate: boolean;
      }
    >(
      ({ marketDetailFetchedAt, refreshOnMarketStatusUpdate }) =>
        useRefreshQuoteWhenStockMarketReopens({
          enabled: true,
          marketDetailFetchedAt,
          marketIsOpen: true,
          onRefresh,
          refreshOnMarketStatusUpdate,
          scopeKey: 'stock-a',
        }),
      {
        initialProps: {
          marketDetailFetchedAt: 1,
          refreshOnMarketStatusUpdate: false,
        },
      },
    );

    expect(onRefresh).not.toHaveBeenCalled();

    rerender({
      marketDetailFetchedAt: 1,
      refreshOnMarketStatusUpdate: true,
    });
    expect(onRefresh).not.toHaveBeenCalled();

    rerender({
      marketDetailFetchedAt: 2,
      refreshOnMarketStatusUpdate: true,
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);

    rerender({
      marketDetailFetchedAt: 2,
      refreshOnMarketStatusUpdate: true,
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);

    rerender({
      marketDetailFetchedAt: 3,
      refreshOnMarketStatusUpdate: true,
    });
    expect(onRefresh).toHaveBeenCalledTimes(2);
  });
});
