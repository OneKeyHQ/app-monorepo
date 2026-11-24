/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import { useQuoteRefresh } from './useQuoteRefresh';

describe('quote refresh across standalone approval', () => {
  it('discards an in-flight deposit quote after entering approval and resumes afterwards', async () => {
    let resolveQuote: (value: { effectiveApy: string }) => void = () => {};
    const firstQuote = new Promise<{ effectiveApy: string }>((resolve) => {
      resolveQuote = resolve;
    });
    const fetchTransactionConfirmation = jest
      .fn()
      .mockReturnValueOnce(firstQuote)
      .mockResolvedValue({ effectiveApy: '4' });
    const setTransactionConfirmation = jest.fn();
    const onQuoteReset = jest.fn();
    const onQuoteRefreshingChange = jest.fn();
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useQuoteRefresh({
          enabled,
          amountValue: '0.01',
          fetchTransactionConfirmation,
          setTransactionConfirmation,
          onQuoteReset,
          onQuoteRefreshingChange,
        }),
      { initialProps: { enabled: true } },
    );

    act(() => result.current.handleLocalRefreshQuote());
    expect(result.current.quoteRefreshing).toBe(true);
    rerender({ enabled: false });
    expect(result.current.quoteRefreshing).toBe(false);

    await act(async () => resolveQuote({ effectiveApy: '3' }));
    expect(setTransactionConfirmation).not.toHaveBeenCalled();
    expect(onQuoteReset).not.toHaveBeenCalled();
    act(() => result.current.handleLocalRefreshQuote());
    expect(fetchTransactionConfirmation).toHaveBeenCalledTimes(1);

    rerender({ enabled: true });
    act(() => result.current.handleLocalRefreshQuote());
    await waitFor(() => expect(onQuoteReset).toHaveBeenCalledTimes(1));
    expect(setTransactionConfirmation).toHaveBeenCalledWith({
      effectiveApy: '4',
    });
    expect(result.current.quoteRefreshing).toBe(false);
  });
});
