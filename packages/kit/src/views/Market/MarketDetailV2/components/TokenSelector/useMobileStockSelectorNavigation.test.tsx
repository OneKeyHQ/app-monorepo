/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import type { useToMarketStockDetailPage } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketStockList/hooks/useToMarketStockDetailPage';
import type { IMarketStockPublicItem } from '@onekeyhq/shared/types/marketV2';

import { useMobileStockSelectorNavigation } from './useMobileStockSelectorNavigation';

jest.mock('./dismissMobileTokenSelectorKeyboard', () => ({
  dismissMobileTokenSelectorKeyboard: jest.fn(),
}));

const stock: IMarketStockPublicItem = {
  stockId: 'AAPL',
  name: 'Apple',
  symbol: 'AAPL',
  logoUrl: '',
  assetType: 'stock',
  currency: 'USD',
};
type IStockNavigation = ReturnType<typeof useToMarketStockDetailPage>;
const navigate = jest.fn<
  ReturnType<IStockNavigation>,
  Parameters<IStockNavigation>
>();
const closeSelector = jest.fn();
const onError = jest.fn();
const requestIdRef = { current: 0 };
const options = { navigate, closeSelector, onError, requestIdRef };

describe('useMobileStockSelectorNavigation', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    requestIdRef.current = 0;
    navigate.mockResolvedValue(true);
  });

  it('closes the selector after successful navigation', async () => {
    const { result } = renderHook(() =>
      useMobileStockSelectorNavigation(options),
    );
    await act(async () => result.current(stock));
    expect(closeSelector).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('keeps the selector open when navigation is suppressed', async () => {
    navigate.mockResolvedValue(false);
    const { result } = renderHook(() =>
      useMobileStockSelectorNavigation(options),
    );
    await act(async () => result.current(stock));
    expect(closeSelector).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('reports a failure, keeps the selector open, and permits retry', async () => {
    navigate.mockRejectedValueOnce(new Error('Preload failed'));
    const { result } = renderHook(() =>
      useMobileStockSelectorNavigation(options),
    );
    await act(async () => result.current(stock));
    expect(closeSelector).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    await act(async () => result.current(stock));
    expect(closeSelector).toHaveBeenCalledTimes(1);
  });

  it('ignores repeated taps while navigation is pending', async () => {
    let complete = (_success: boolean) => {};
    navigate.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          complete = resolve;
        }),
    );
    const { result } = renderHook(() =>
      useMobileStockSelectorNavigation(options),
    );
    act(() => {
      result.current(stock);
      result.current(stock);
    });
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(closeSelector).not.toHaveBeenCalled();
    await act(async () => complete(true));
    expect(closeSelector).toHaveBeenCalledTimes(1);
  });

  it.each([true, false])(
    'does not close or report errors for an obsolete request (success: %s)',
    async (success) => {
      let complete = () => {};
      navigate.mockImplementationOnce(
        () =>
          new Promise<boolean>((resolve, reject) => {
            complete = () =>
              success ? resolve(true) : reject(new Error('Preload failed'));
          }),
      );
      const { result } = renderHook(() =>
        useMobileStockSelectorNavigation(options),
      );
      act(() => result.current(stock));
      requestIdRef.current += 1;
      expect(navigate.mock.calls[0][1]?.isCurrentRequest()).toBe(false);
      await act(async () => complete());
      expect(closeSelector).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    },
  );

  it('invalidates pending navigation when the selector unmounts', async () => {
    let complete = (_success: boolean) => {};
    navigate.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          complete = resolve;
        }),
    );
    const { result, unmount } = renderHook(() =>
      useMobileStockSelectorNavigation(options),
    );
    act(() => result.current(stock));
    unmount();
    expect(navigate.mock.calls[0][1]?.isCurrentRequest()).toBe(false);
    await act(async () => complete(true));
    expect(closeSelector).not.toHaveBeenCalled();
  });
});
