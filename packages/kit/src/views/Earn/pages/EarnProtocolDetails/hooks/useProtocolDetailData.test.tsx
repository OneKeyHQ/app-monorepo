/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { swrCacheUtils } from '@onekeyhq/shared/src/utils/swrCacheUtils';
import type { IStakeEarnDetail } from '@onekeyhq/shared/types/staking';

import { useProtocolDetailData } from './useProtocolDetailData';

const mockLocale = { current: 'en-US' };
const mockCurrency = { current: 'usd' };
const mockAccount: { address?: string; loading: boolean } = { loading: false };
let mockIsFocused = true;
const mockRefreshAccount = jest.fn();

jest.mock('react-intl', () => ({
  useIntl: () => ({ locale: mockLocale.current }),
}));

jest.mock('@onekeyhq/kit/src/components/Currency', () => ({
  useCurrency: () => ({ id: mockCurrency.current }),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceStaking: { getProtocolDetailsV2: jest.fn() } },
}));

jest.mock('@onekeyhq/kit/src/views/Staking/hooks/useEarnAccount', () => ({
  useEarnAccount: () => ({
    earnAccount: mockAccount.address
      ? { accountAddress: mockAccount.address }
      : undefined,
    refreshAccount: mockRefreshAccount,
    isLoading: mockAccount.loading,
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => mockIsFocused,
}));

jest.mock('@onekeyhq/components', () => ({
  getCurrentVisibilityState: () => true,
  onVisibilityStateChange: () => () => {},
  useDeferredPromise: jest.requireActual<
    Pick<typeof import('@onekeyhq/components'), 'useDeferredPromise'>
  >('../../../../../../../components/src/hooks/useDeferredPromise')
    .useDeferredPromise,
  useNetInfo: () => ({}),
}));

jest.mock('@onekeyhq/shared/src/utils/swrCacheUtils', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/utils/swrCacheUtils')
  >('@onekeyhq/shared/src/utils/swrCacheUtils');
  return {
    ...actual,
    swrCacheUtils: { getWithTimestamp: jest.fn(), set: jest.fn() },
  };
});

const getDetails = jest.spyOn(
  backgroundApiProxy.serviceStaking,
  'getProtocolDetailsV2',
);
const getWithTimestamp = jest.spyOn(swrCacheUtils, 'getWithTimestamp');

const detailParams = {
  accountId: '',
  indexedAccountId: 'hd-test--1',
  networkId: 'evm--1',
  symbol: 'USDC',
  provider: 'etherfi',
  vault: '0xVault',
  includeAccountContext: true,
};

function progress(amount: string): IStakeEarnDetail {
  return {
    bonusProgress: {
      status: 'earning',
      title: 'Campaign bonus',
      bonus: { amount, symbol: 'USDC' },
      isEstimated: true,
      payoutAt: 1_800_000_000_000,
      deposits: [],
    },
  };
}

beforeEach(() => {
  mockLocale.current = 'en-US';
  mockCurrency.current = 'usd';
  mockAccount.address = undefined;
  mockAccount.loading = false;
  mockIsFocused = true;
  mockRefreshAccount.mockReset();
  getDetails.mockReset();
  getDetails.mockResolvedValue({});
  getWithTimestamp.mockClear();
});

it('reruns in a new cache scope after locale or currency changes', async () => {
  const { rerender } = renderHook(() =>
    useProtocolDetailData({
      ...detailParams,
      indexedAccountId: undefined,
      includeAccountContext: false,
    }),
  );

  await waitFor(() => expect(getDetails).toHaveBeenCalledTimes(1));
  expect(getWithTimestamp).toHaveBeenLastCalledWith(
    expect.stringContaining(':en-us:usd'),
  );

  mockLocale.current = 'zh-CN';
  mockCurrency.current = 'cny';
  rerender(undefined);

  await waitFor(() => expect(getDetails).toHaveBeenCalledTimes(2));
  expect(getWithTimestamp).toHaveBeenLastCalledWith(
    expect.stringContaining(':zh-cn:cny'),
  );
});

it('replaces the detail when the same indexed account resolves a different address', async () => {
  mockAccount.address = '0xA';
  getDetails
    .mockResolvedValueOnce(progress('1'))
    .mockResolvedValue(progress('2'));

  const { result, rerender } = renderHook(() =>
    useProtocolDetailData(detailParams),
  );
  await waitFor(() => expect(result.current.detailInfo).toEqual(progress('1')));

  mockAccount.address = undefined;
  mockAccount.loading = true;
  rerender(undefined);

  expect(result.current.detailInfo).toBeUndefined();
  expect(result.current.isLoading).toBe(true);
  expect(getDetails).toHaveBeenCalledTimes(1);

  mockAccount.address = '0xB';
  mockAccount.loading = false;
  rerender(undefined);

  await waitFor(() => expect(result.current.detailInfo).toEqual(progress('2')));
  expect(getDetails).toHaveBeenCalledTimes(2);
  expect(getDetails).toHaveBeenLastCalledWith(
    expect.objectContaining({
      indexedAccountId: detailParams.indexedAccountId,
      expectedAccountAddress: '0xB',
    }),
  );
});

it('drops a late response for the previous derivation', async () => {
  mockAccount.address = '0xA';
  const oldRequest = Promise.withResolvers<IStakeEarnDetail>();
  getDetails
    .mockReturnValueOnce(oldRequest.promise)
    .mockResolvedValue(progress('2'));

  const { result, rerender } = renderHook(() =>
    useProtocolDetailData(detailParams),
  );
  await waitFor(() => expect(getDetails).toHaveBeenCalledTimes(1));

  mockAccount.address = undefined;
  mockAccount.loading = true;
  rerender(undefined);

  mockAccount.address = '0xB';
  mockAccount.loading = false;
  rerender(undefined);

  await waitFor(() => expect(result.current.detailInfo).toEqual(progress('2')));
  await act(async () => oldRequest.resolve(progress('1')));
  expect(result.current.detailInfo).toEqual(progress('2'));
});

it('exposes a retryable error when the current account detail is canceled', async () => {
  mockAccount.address = '0xA';
  getDetails
    .mockResolvedValueOnce(progress('1'))
    .mockRejectedValueOnce({ code: 'ERR_CANCELED' })
    .mockResolvedValue(progress('2'));
  const { result, rerender } = renderHook(() =>
    useProtocolDetailData(detailParams),
  );
  await waitFor(() => expect(result.current.detailInfo).toEqual(progress('1')));

  await act(async () => result.current.refreshData());

  expect(result.current.detailInfo).toBeUndefined();
  expect(result.current.isError).toBe(true);
  expect(result.current.isLoading).toBe(false);

  await act(async () => result.current.retryDetail());
  expect(mockRefreshAccount).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(result.current.detailInfo).toEqual(progress('2')));

  mockAccount.address = '0xB';
  rerender(undefined);

  await waitFor(() =>
    expect(getDetails).toHaveBeenLastCalledWith(
      expect.objectContaining({ expectedAccountAddress: '0xB' }),
    ),
  );
});

it('retries with the new address after account resolution changes', async () => {
  mockAccount.address = '0xA';
  getDetails.mockImplementation(async ({ expectedAccountAddress }) =>
    expectedAccountAddress === '0xB'
      ? progress('2')
      : Promise.reject(
          Object.assign(new Error('Canceled'), { code: 'ERR_CANCELED' }),
        ),
  );
  // The first request is canceled before the account hook catches up.
  getDetails.mockRejectedValueOnce({ code: 'ERR_CANCELED' });
  const { result, rerender } = renderHook(() =>
    useProtocolDetailData(detailParams),
  );
  await waitFor(() => expect(result.current.isError).toBe(true));
  mockRefreshAccount.mockImplementation(async () => {
    mockAccount.address = '0xB';
    rerender(undefined);
  });

  await act(async () => result.current.retryDetail());

  await waitFor(() => expect(result.current.detailInfo).toEqual(progress('2')));
  expect(getDetails).toHaveBeenLastCalledWith(
    expect.objectContaining({ expectedAccountAddress: '0xB' }),
  );
});

it('ignores a stale retry cancellation after the new address has loaded', async () => {
  mockAccount.address = '0xA';
  const oldRetry = Promise.withResolvers<IStakeEarnDetail>();
  getDetails
    .mockRejectedValueOnce({ code: 'ERR_CANCELED' })
    .mockReturnValueOnce(oldRetry.promise)
    .mockResolvedValue(progress('2'));
  const { result, rerender } = renderHook(() =>
    useProtocolDetailData(detailParams),
  );
  await waitFor(() => expect(result.current.isError).toBe(true));

  let retry: Promise<void> | undefined;
  await act(async () => {
    retry = result.current.retryDetail();
    await Promise.resolve();
  });
  await waitFor(() => expect(getDetails).toHaveBeenCalledTimes(2));
  mockAccount.address = '0xB';
  rerender(undefined);
  await waitFor(() => expect(result.current.detailInfo).toEqual(progress('2')));
  await act(async () => {
    oldRetry.reject({ code: 'ERR_CANCELED' });
    await retry;
  });
  expect(result.current.detailInfo).toEqual(progress('2'));
  expect(result.current.isError).toBe(false);
  expect(result.current.isLoading).toBe(false);
});

it('does not let an older canceled request override a newer failure', async () => {
  mockAccount.address = '0xA';
  const oldRequest = Promise.withResolvers<IStakeEarnDetail>();
  getDetails
    .mockReturnValueOnce(oldRequest.promise)
    .mockRejectedValueOnce({ code: 'ERR_CANCELED' });
  const { result } = renderHook(() => useProtocolDetailData(detailParams));
  await waitFor(() => expect(getDetails).toHaveBeenCalledTimes(1));
  await act(async () => result.current.refreshData());
  expect(result.current.isError).toBe(true);
  await act(async () => oldRequest.reject({ code: 'ERR_CANCELED' }));
  expect(result.current.isError).toBe(true);
  expect(result.current.isLoading).toBe(false);
});

it('loads public details when account resolution finishes without an address', async () => {
  mockAccount.loading = true;
  const { result, rerender } = renderHook(() =>
    useProtocolDetailData(detailParams),
  );

  await act(async () => {});
  expect(result.current.isLoading).toBe(true);
  expect(getDetails).not.toHaveBeenCalled();

  mockAccount.loading = false;
  rerender(undefined);

  await waitFor(() => expect(result.current.detailInfo).toEqual({}));
  expect(getDetails).toHaveBeenCalledWith({
    networkId: detailParams.networkId,
    provider: detailParams.provider,
    symbol: detailParams.symbol,
    vault: detailParams.vault,
  });
});

it('reloads the wide reward detail on focus after a refresh during blur', async () => {
  mockAccount.address = '0xA';
  getDetails
    .mockResolvedValueOnce(progress('1'))
    .mockResolvedValue(progress('2'));

  const { result, rerender } = renderHook(() =>
    useProtocolDetailData({ ...detailParams, revalidateOnFocus: true }),
  );
  await waitFor(() => expect(result.current.detailInfo).toEqual(progress('1')));

  mockIsFocused = false;
  rerender(undefined);
  await act(async () => result.current.refreshData());
  expect(getDetails).toHaveBeenCalledTimes(1);

  mockIsFocused = true;
  rerender(undefined);

  await waitFor(() => expect(result.current.detailInfo).toEqual(progress('2')));
  expect(getDetails).toHaveBeenCalledTimes(2);
});
