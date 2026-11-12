/** @jest-environment jsdom */
// cspell:ignore financials
import { act, renderHook, waitFor } from '@testing-library/react';

import type {
  IStockFinancialPeriod,
  IStockFinancials,
} from '@onekeyhq/shared/types/marketStockFinancials';

import { useStockFinancials } from './useStockFinancials';

const mockFetch = jest.fn<
  Promise<IStockFinancials | null>,
  [{ stockId: string; period: IStockFinancialPeriod }]
>();
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarketV2: {
      fetchMarketStockFinancials: (params: {
        stockId: string;
        period: IStockFinancialPeriod;
      }) => mockFetch(params),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
  useRouteIsFocusedWhenEnabled: () => true,
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isWeb: true },
}));
jest.mock('@onekeyhq/components', () => ({
  getCurrentVisibilityState: () => true,
  onVisibilityStateChange: () => () => undefined,
  useNetInfo: () => ({ isRawInternetReachable: true }),
  useDeferredPromise: jest.requireActual<
    typeof import('@onekeyhq/components/src/hooks/useDeferredPromise')
  >('../../../../../../../components/src/hooks/useDeferredPromise')
    .useDeferredPromise,
}));

function response(
  stockId: string,
  period: IStockFinancialPeriod,
): IStockFinancials {
  return {
    stockId,
    period,
    currency: 'USD',
    updatedAt: '2026-09-08',
    partial: false,
    unavailableSources: [],
    performance: [],
    debtLevelAndCoverage: [],
    earnings: { items: [] },
  };
}

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockImplementation(async ({ stockId, period }) =>
    response(stockId, period),
  );
});

it('does not request financials without a stock identity', async () => {
  const initialProps: { stockId?: string } = { stockId: undefined };
  const hook = renderHook(
    ({ stockId }: { stockId?: string }) => useStockFinancials(stockId),
    { initialProps },
  );
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  expect(mockFetch).not.toHaveBeenCalled();
  hook.rerender({ stockId: 'AMD' });
  await waitFor(() => expect(hook.result.current.result?.stockId).toBe('AMD'));
  expect(mockFetch).toHaveBeenCalledTimes(2);
  hook.rerender({ stockId: undefined });
  expect(hook.result.current.result).toBeUndefined();
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  expect(mockFetch).toHaveBeenCalledTimes(2);
});

it('reuses cached periods after unmount and refreshes on explicit retry', async () => {
  const first = renderHook(() => useStockFinancials('AAPL'));
  await waitFor(() =>
    expect(first.result.current.result?.stockId).toBe('AAPL'),
  );
  expect(mockFetch).toHaveBeenCalledTimes(2);
  first.unmount();
  const second = renderHook(() => useStockFinancials(' aapl '));
  await waitFor(() =>
    expect(second.result.current.result?.stockId).toBe('AAPL'),
  );
  expect(mockFetch).toHaveBeenCalledTimes(2);
  await act(async () => second.result.current.retry());
  expect(mockFetch).toHaveBeenCalledTimes(4);
});

it('does not expose the previous stock while the next stock is loading', async () => {
  const hook = renderHook(({ stockId }) => useStockFinancials(stockId), {
    initialProps: { stockId: 'NVDA' },
  });
  await waitFor(() => expect(hook.result.current.result?.stockId).toBe('NVDA'));
  const pending: Array<() => void> = [];
  mockFetch.mockImplementation(
    ({ stockId, period }) =>
      new Promise((resolve) => {
        pending.push(() => resolve(response(stockId, period)));
      }),
  );
  hook.rerender({ stockId: 'MSFT' });
  expect(hook.result.current.result).toBeUndefined();
  await waitFor(() => expect(pending).toHaveLength(2));
  await act(async () => {
    pending.forEach((resolve) => resolve());
  });
  await waitFor(() => expect(hook.result.current.result?.stockId).toBe('MSFT'));
});
