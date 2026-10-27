/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import { usePortfolioData } from './usePortfolioData';

const mockFetchPortfolio = jest.fn(async (_params: unknown) => ({ list: [] }));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarketV2: {
      fetchMarketAccountPortfolio: (params: unknown) =>
        mockFetchPortfolio(params),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => true,
}));

jest.mock('@onekeyhq/components', () => {
  const deferred = jest.requireActual<
    typeof import('@onekeyhq/components/src/hooks/useDeferredPromise')
  >('../../../../../../../../../../components/src/hooks/useDeferredPromise');
  return {
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => {},
    useNetInfo: () => ({ isRawInternetReachable: true }),
    useDeferredPromise: deferred.useDeferredPromise,
  };
});

it('fetches immediately when the account becomes ready, then keeps polling', async () => {
  jest.useFakeTimers();
  const flush = async () => {
    await act(async () => {
      jest.advanceTimersByTime(0);
      for (let index = 0; index < 10; index += 1) {
        await Promise.resolve();
      }
    });
  };
  const { rerender, unmount } = renderHook(
    ({ accountAddress }: { accountAddress?: string }) =>
      usePortfolioData({
        networkId: 'btc--0',
        tokenAddress: '',
        accountAddress,
      }),
    { initialProps: { accountAddress: undefined as string | undefined } },
  );
  try {
    await flush();
    expect(mockFetchPortfolio).not.toHaveBeenCalled();
    rerender({ accountAddress: 'account-a' });
    await flush();
    expect(mockFetchPortfolio).toHaveBeenCalledTimes(1);
    expect(mockFetchPortfolio).toHaveBeenLastCalledWith(
      expect.objectContaining({ accountAddress: 'account-a' }),
    );
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    await flush();
    expect(mockFetchPortfolio).toHaveBeenCalledTimes(2);
  } finally {
    unmount();
    jest.useRealTimers();
  }
});
