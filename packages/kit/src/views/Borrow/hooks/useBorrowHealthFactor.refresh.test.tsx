/* eslint-disable import/first */

const mockGetHealthFactor = jest.fn<Promise<unknown>, unknown[]>();

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => true,
}));
jest.mock('@onekeyhq/shared/src/utils/swrCacheUtils', () => ({
  ...jest.requireActual<
    typeof import('@onekeyhq/shared/src/utils/swrCacheUtils')
  >('@onekeyhq/shared/src/utils/swrCacheUtils'),
  swrCacheUtils: { getWithTimestamp: jest.fn(), set: jest.fn() },
}));
jest.mock('@onekeyhq/components', () => {
  const { useDeferredPromise } = jest.requireActual<
    typeof import('../../../../../components/src/hooks/useDeferredPromise')
  >('../../../../../components/src/hooks/useDeferredPromise');
  return {
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => undefined,
    useDeferredPromise,
    useNetInfo: () => ({ isRawInternetReachable: true }),
  };
});
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      getBorrowHealthFactor: (...args: unknown[]) =>
        mockGetHealthFactor(...args),
    },
  },
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';

import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import type { IBorrowHealthFactor } from '@onekeyhq/shared/types/staking';

import { useBorrowHealthFactor } from './useBorrowHealthFactor';

it('shows the complete cached warning while fetching and replaces it with the complete fresh warning', async () => {
  const params = {
    networkId: 'evm--1',
    provider: 'aave',
    marketAddress: '0xMarket',
    accountId: 'account-1',
  };
  const key = swrKeys.borrowHealthFactor(params);
  const cached: IBorrowHealthFactor = {
    healthFactor: { text: { text: '1.5' } },
    alerts: [{ title: { text: 'Old warning' }, badge: 'warning' }],
  };
  const fresh: IBorrowHealthFactor = {
    healthFactor: { text: { text: '1.6' } },
    alerts: [{ title: { text: 'New warning' }, badge: 'warning' }],
  };
  const updatedAt = Date.now() - 1000;
  jest.mocked(swrCacheUtils.getWithTimestamp).mockImplementation((cacheKey) =>
    cacheKey === key
      ? {
          data: {
            scopeKey: JSON.stringify([
              params.networkId,
              params.provider,
              params.marketAddress,
              params.accountId,
              true,
            ]),
            data: cached,
            state: 'resolved',
            resolvedAt: updatedAt,
          },
          updatedAt,
        }
      : undefined,
  );
  let resolveRequest: ((value: IBorrowHealthFactor) => void) | undefined;
  mockGetHealthFactor.mockReturnValueOnce(
    new Promise<IBorrowHealthFactor>((resolve) => {
      resolveRequest = resolve;
    }),
  );

  const view = renderHook(() => useBorrowHealthFactor(params));
  expect(view.result.current.healthFactorData).toEqual(cached);
  await waitFor(() => expect(mockGetHealthFactor).toHaveBeenCalledTimes(1));
  expect(view.result.current.healthFactorData).toEqual(cached);

  expect(resolveRequest).toBeDefined();
  await act(async () => resolveRequest?.(fresh));
  await waitFor(() =>
    expect(view.result.current.healthFactorData).toEqual(fresh),
  );
  expect(swrCacheUtils.set).toHaveBeenCalledWith(
    key,
    expect.objectContaining({ data: fresh, state: 'resolved' }),
  );
  view.unmount();
});
