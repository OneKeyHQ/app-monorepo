/* eslint-disable import/first */
/* eslint-disable @typescript-eslint/unbound-method -- Jest assertions inspect mocked methods without invoking them unbound. */

jest.mock('react-intl', () => ({
  useIntl: () => ({ locale: 'zh-CN' }),
}));
jest.mock('@onekeyhq/kit/src/components/Currency', () => ({
  useCurrency: () => ({ id: 'usd' }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      getEarnAccount: jest.fn(),
      getManagePage: jest.fn(),
      getBorrowManagePage: jest.fn(),
      getProtocolList: jest.fn(),
      getProtocolDetailsV2: jest.fn(),
    },
  },
}));
jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: { isBTCNetwork: () => false },
}));
jest.mock('@onekeyhq/shared/src/utils/earnUtils', () => ({
  __esModule: true,
  default: { shouldSendEarnProtocolVault: () => true },
}));
jest.mock('../../../utils/utils', () => ({
  buildLocalTxStatusSyncId: () => 'sync-id',
}));
jest.mock('@onekeyhq/shared/src/utils/swrCacheUtils', () => ({
  swrCacheUtils: { getWithTimestamp: jest.fn(), set: jest.fn() },
  swrKeys: {
    earnProtocolDetail: jest.fn((params) => JSON.stringify(params)),
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: jest.fn(() => ({
    result: undefined,
    isLoading: false,
    run: jest.fn(),
  })),
}));

import { renderHook } from '@testing-library/react-native';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import {
  EManagePositionType,
  type IEarnManagePageResponse,
} from '@onekeyhq/shared/types/staking';

import { useManagePage } from './useManagePage';

describe('useManagePage receipt approval compatibility', () => {
  const vault = '0xReceipt';
  const params = {
    accountId: 'account',
    indexedAccountId: 'indexed-account',
    networkId: 'evm--1',
    symbol: 'ETH' as const,
    provider: 'etherfi',
    vault,
  };
  const withdrawApprove = {
    amountUnit: 'shares' as const,
    approveTarget: '0xQueue',
    tokenAddress: vault,
  };
  const managePageData = {
    deposit: { data: { token: { info: { address: '' } } } },
    withdraw: { data: { token: { info: { address: vault } } } },
  } as IEarnManagePageResponse;
  const staking = jest.mocked(backgroundApiProxy.serviceStaking);

  /** Run the real loader without coupling request assertions to render timing. */
  const load = async () => {
    const call = jest.mocked(usePromiseResult).mock.calls.at(-1);
    if (!call)
      throw new OneKeyLocalError('Manage-page loader was not registered');
    return (await call[0]()) as {
      managePageData?: IEarnManagePageResponse;
      withdrawApprove?: typeof withdrawApprove;
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(swrCacheUtils.getWithTimestamp).mockReturnValue(undefined);
    staking.getEarnAccount.mockResolvedValue({
      accountAddress: '0xUser',
      account: {},
    } as Awaited<ReturnType<typeof staking.getEarnAccount>>);
    staking.getManagePage.mockResolvedValue(managePageData);
    staking.getProtocolList.mockResolvedValue([]);
    staking.getProtocolDetailsV2.mockResolvedValue({ withdrawApprove });
  });

  it('loads only account-less details when manage-page omits receipt approval', async () => {
    renderHook(() => useManagePage(params));
    const result = await load();
    expect(staking.getProtocolDetailsV2).toHaveBeenCalledWith({
      networkId: params.networkId,
      symbol: params.symbol,
      provider: params.provider,
      vault,
    });
    expect(result.withdrawApprove).toEqual(withdrawApprove);
    expect(result.managePageData).not.toHaveProperty('withdrawApprove');
  });

  it('reuses details already loaded under the same complete cache identity', async () => {
    jest.mocked(swrCacheUtils.getWithTimestamp).mockReturnValue({
      data: { withdrawApprove },
      updatedAt: Date.now(),
    });
    renderHook(() => useManagePage(params));
    expect((await load()).withdrawApprove).toEqual(withdrawApprove);
    expect(swrKeys.earnProtocolDetail).toHaveBeenCalledWith({
      networkId: params.networkId,
      symbol: params.symbol,
      provider: params.provider,
      vault,
      locale: 'zh-CN',
      currencyId: 'usd',
    });
    expect(staking.getProtocolDetailsV2).not.toHaveBeenCalled();
  });

  it('uses a new identity after switching providers instead of old details', async () => {
    const { rerender } = renderHook(
      (value: typeof params) => useManagePage(value),
      {
        initialProps: params,
      },
    );
    await load();
    const initialKey = jest.mocked(swrCacheUtils.getWithTimestamp).mock
      .calls[0][0];
    rerender({ ...params, provider: 'another-provider' });
    await load();
    expect(
      jest.mocked(swrCacheUtils.getWithTimestamp).mock.calls.at(-1)?.[0],
    ).not.toBe(initialKey);
    expect(staking.getProtocolDetailsV2).toHaveBeenLastCalledWith({
      networkId: params.networkId,
      symbol: params.symbol,
      provider: 'another-provider',
      vault,
    });
  });

  it('does not request details for Borrow', async () => {
    staking.getBorrowManagePage.mockResolvedValue(managePageData);
    renderHook(() =>
      useManagePage({ ...params, type: EManagePositionType.Borrow }),
    );
    await load();
    expect(staking.getProtocolDetailsV2).not.toHaveBeenCalled();
  });

  it('returns no actionable manage-page data if receipt approval cannot be loaded', async () => {
    staking.getProtocolDetailsV2.mockResolvedValue({});
    renderHook(() => useManagePage(params));
    expect((await load()).managePageData).toBeUndefined();
  });
});
