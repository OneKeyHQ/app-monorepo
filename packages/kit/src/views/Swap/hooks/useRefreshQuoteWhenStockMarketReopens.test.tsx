import { act, renderHook } from '@testing-library/react-native';

import { useRefreshQuoteWhenStockMarketReopens } from './useRefreshQuoteWhenStockMarketReopens';

describe('useRefreshQuoteWhenStockMarketReopens', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

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

  it('retries a current closed quote with a bounded backoff', () => {
    const onRefresh = jest.fn();
    const { rerender } = renderHook<void, { quoteMarketClosed: boolean }>(
      ({ quoteMarketClosed }) =>
        useRefreshQuoteWhenStockMarketReopens({
          enabled: true,
          marketIsOpen: true,
          onRefresh,
          quoteMarketClosed,
          scopeKey: 'stock-a|usdc|22',
        }),
      {
        initialProps: {
          quoteMarketClosed: false,
        },
      },
    );

    const receiveClosedQuote = () => {
      rerender({ quoteMarketClosed: false });
      rerender({ quoteMarketClosed: true });
    };

    receiveClosedQuote();
    act(() => {
      jest.advanceTimersByTime(1999);
    });
    expect(onRefresh).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);

    receiveClosedQuote();
    act(() => {
      jest.advanceTimersByTime(3999);
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(onRefresh).toHaveBeenCalledTimes(2);

    receiveClosedQuote();
    act(() => {
      jest.advanceTimersByTime(7999);
    });
    expect(onRefresh).toHaveBeenCalledTimes(2);
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(onRefresh).toHaveBeenCalledTimes(3);

    receiveClosedQuote();
    expect(jest.getTimerCount()).toBe(0);
    expect(onRefresh).toHaveBeenCalledTimes(3);
  });

  it('cancels a pending closed-quote retry when the market closes', () => {
    const onRefresh = jest.fn();
    const { rerender } = renderHook<
      void,
      { marketIsOpen: boolean; quoteMarketClosed: boolean }
    >(
      ({ marketIsOpen, quoteMarketClosed }) =>
        useRefreshQuoteWhenStockMarketReopens({
          enabled: true,
          marketIsOpen,
          onRefresh,
          quoteMarketClosed,
          scopeKey: 'stock-a|usdc|22',
        }),
      {
        initialProps: {
          marketIsOpen: true,
          quoteMarketClosed: true,
        },
      },
    );

    rerender({ marketIsOpen: false, quoteMarketClosed: true });
    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('resets the closed-quote retry budget for a new quote identity', () => {
    const onRefresh = jest.fn();
    const { rerender } = renderHook<
      void,
      { quoteMarketClosed: boolean; scopeKey: string }
    >(
      ({ quoteMarketClosed, scopeKey }) =>
        useRefreshQuoteWhenStockMarketReopens({
          enabled: true,
          marketIsOpen: true,
          onRefresh,
          quoteMarketClosed,
          scopeKey,
        }),
      {
        initialProps: {
          quoteMarketClosed: true,
          scopeKey: 'stock-a|usdc|22',
        },
      },
    );

    for (let retryCount = 0; retryCount < 3; retryCount += 1) {
      act(() => {
        jest.runOnlyPendingTimers();
      });
      rerender({
        quoteMarketClosed: false,
        scopeKey: 'stock-a|usdc|22',
      });
      rerender({
        quoteMarketClosed: true,
        scopeKey: 'stock-a|usdc|22',
      });
    }
    expect(jest.getTimerCount()).toBe(0);

    rerender({
      quoteMarketClosed: true,
      scopeKey: 'stock-a|usdc|23',
    });
    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(onRefresh).toHaveBeenCalledTimes(4);
  });
});
