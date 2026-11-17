/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react-native';

import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { useSwapMarketDetailToken } from './useSwapMarketDetailToken';

const mockResolveStock = jest.fn<Promise<ISwapToken>, [ISwapToken]>();
const mockToastError = jest.fn<void, [unknown]>();
let mockFocused = true;

jest.mock('../utils/swapStockMarketData', () => ({
  resolveSwapStockSelectionToken: (token: ISwapToken) =>
    mockResolveStock(token),
}));
jest.mock('@onekeyhq/components', () => ({
  Toast: { error: (options: unknown) => mockToastError(options) },
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => mockFocused,
}));
jest.mock('@onekeyhq/kit/src/utils/onboardingEntryGate', () => ({
  shouldRedirectOnboardingToTravelMode: () => false,
}));

const apple: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xapple',
  symbol: 'AAPLon',
  decimals: 18,
  isStock: true,
};
const nvidia: ISwapToken = {
  ...apple,
  contractAddress: '0xnvidia',
  symbol: 'NVDAon',
};
const resolvedApple: ISwapToken = {
  ...apple,
  stock: { stockId: 'AAPL', subtitle: 'Apple', sourceLogoUri: '' },
};
const resolvedNvidia: ISwapToken = {
  ...nvidia,
  stock: { stockId: 'NVDA', subtitle: 'Nvidia', sourceLogoUri: '' },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('useSwapMarketDetailToken', () => {
  beforeEach(() => {
    mockResolveStock.mockReset();
    mockToastError.mockReset();
    mockFocused = true;
  });

  it('keeps ordinary token navigation synchronous without resolving a stock', async () => {
    const token = { ...apple, isStock: false };
    const onOpen = jest.fn();
    const { result } = renderHook(() =>
      useSwapMarketDetailToken({ token, onOpen }),
    );
    await act(async () => {
      await result.current.onOpenMarketDetail();
    });
    expect(onOpen).toHaveBeenCalledWith(token);
    expect(mockResolveStock).not.toHaveBeenCalled();
  });

  it('opens a legacy stock only after identity resolution and ignores duplicate clicks', async () => {
    const pending = deferred<ISwapToken>();
    mockResolveStock.mockReturnValueOnce(pending.promise);
    const onOpen = jest.fn();
    const { result } = renderHook(() =>
      useSwapMarketDetailToken({ token: apple, onOpen }),
    );
    let open!: Promise<void>;
    act(() => {
      open = result.current.onOpenMarketDetail();
    });
    await act(async () => {
      await result.current.onOpenMarketDetail();
    });
    expect(onOpen).not.toHaveBeenCalled();
    expect(mockResolveStock).toHaveBeenCalledTimes(1);
    await act(async () => {
      pending.resolve(resolvedApple);
      await open;
    });
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(resolvedApple);
    expect(result.current.isLoading).toBe(false);
  });

  it('does not open an old stock or clear a newer lookup when the selection changes', async () => {
    const oldLookup = deferred<ISwapToken>();
    const newLookup = deferred<ISwapToken>();
    mockResolveStock
      .mockReturnValueOnce(oldLookup.promise)
      .mockReturnValueOnce(newLookup.promise);
    const onOpen = jest.fn();
    const { result, rerender } = renderHook<
      ReturnType<typeof useSwapMarketDetailToken>,
      { token: ISwapToken }
    >(({ token }) => useSwapMarketDetailToken({ token, onOpen }), {
      initialProps: { token: apple },
    });
    let oldOpen!: Promise<void>;
    let newOpen!: Promise<void>;
    act(() => {
      oldOpen = result.current.onOpenMarketDetail();
    });
    rerender({ token: nvidia });
    act(() => {
      newOpen = result.current.onOpenMarketDetail();
    });
    await act(async () => {
      oldLookup.resolve(resolvedApple);
      await oldOpen;
    });
    expect(onOpen).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(true);
    await act(async () => {
      newLookup.resolve(resolvedNvidia);
      await newOpen;
    });
    expect(onOpen).toHaveBeenCalledWith(resolvedNvidia);
    expect(result.current.isLoading).toBe(false);
  });

  it('invalidates an earlier lookup even after switching away and back to the same stock', async () => {
    const pending = deferred<ISwapToken>();
    mockResolveStock.mockReturnValueOnce(pending.promise);
    const onOpen = jest.fn();
    const { result, rerender } = renderHook<
      ReturnType<typeof useSwapMarketDetailToken>,
      { token: ISwapToken }
    >(({ token }) => useSwapMarketDetailToken({ token, onOpen }), {
      initialProps: { token: apple },
    });
    let open!: Promise<void>;
    act(() => {
      open = result.current.onOpenMarketDetail();
    });
    rerender({ token: nvidia });
    rerender({ token: apple });
    await act(async () => {
      pending.resolve(resolvedApple);
      await open;
    });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('does not navigate or report an old lookup error after leaving the page', async () => {
    const pending = deferred<ISwapToken>();
    mockResolveStock.mockReturnValueOnce(pending.promise);
    const onOpen = jest.fn();
    const { result, rerender } = renderHook(() =>
      useSwapMarketDetailToken({ token: apple, onOpen }),
    );
    let open!: Promise<void>;
    act(() => {
      open = result.current.onOpenMarketDetail();
    });
    mockFocused = false;
    rerender({});
    await act(async () => {
      pending.reject(new Error('lookup failed'));
      await open;
    });
    expect(onOpen).not.toHaveBeenCalled();
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('keeps failed resolution retryable without opening an incomplete detail', async () => {
    mockResolveStock
      .mockRejectedValueOnce(new Error('lookup failed'))
      .mockResolvedValueOnce(resolvedApple);
    const onOpen = jest.fn();
    const { result } = renderHook(() =>
      useSwapMarketDetailToken({ token: apple, onOpen }),
    );
    await act(async () => {
      await result.current.onOpenMarketDetail();
    });
    expect(onOpen).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(false);
    await act(async () => {
      await result.current.onOpenMarketDetail();
    });
    expect(onOpen).toHaveBeenCalledWith(resolvedApple);
  });
});
