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
});
