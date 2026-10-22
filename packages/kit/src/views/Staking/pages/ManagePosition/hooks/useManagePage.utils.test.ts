import {
  EManagePositionType,
  type IEarnManagePageResponse,
  type IStakeEarnDetail,
} from '@onekeyhq/shared/types/staking';

import {
  buildManagePageApproveInfo,
  buildManagePageRequestKey,
  resolveManagePageWithdrawApprove,
  shouldBlockManagePageAction,
} from './useManagePage.utils';

describe('useManagePage utils', () => {
  it('preserves an unknown allowance when only the approve target is provided', () => {
    expect(
      buildManagePageApproveInfo({
        approve: undefined,
        approveAsset: undefined,
        approveTarget: '0xspender',
      })?.allowance,
    ).toBeUndefined();
  });

  it('includes indexed account identity in the request key', () => {
    const baseParams = {
      accountId: '',
      networkId: 'evm--1',
      symbol: 'ETH',
      provider: 'lido',
      type: EManagePositionType.Staking,
    };

    expect(
      buildManagePageRequestKey({
        ...baseParams,
        indexedAccountId: 'indexed-account-1',
      }),
    ).not.toBe(
      buildManagePageRequestKey({
        ...baseParams,
        indexedAccountId: 'indexed-account-2',
      }),
    );
  });

  it('blocks stale data even without a protocol switcher', () => {
    expect(
      shouldBlockManagePageAction({
        hasManagePageData: true,
        isStaleData: true,
        isLoading: false,
        hasProtocolSwitch: false,
      }),
    ).toBe(true);
  });

  it('does not block an ordinary same-scope refresh', () => {
    expect(
      shouldBlockManagePageAction({
        hasManagePageData: true,
        isStaleData: false,
        isLoading: true,
        hasProtocolSwitch: false,
      }),
    ).toBe(false);
  });
});

describe('manage-page receipt withdrawal approval', () => {
  const vault = '0xReceipt';
  const approve = {
    approveTarget: '0xQueue',
    tokenAddress: vault,
    amountUnit: 'shares' as const,
  };
  const detail = { withdrawApprove: approve } as IStakeEarnDetail;
  const managePageData = {
    deposit: { data: { token: { info: { address: '0xInput' } } } },
    withdraw: { data: { token: { info: { address: vault } } } },
  } as IEarnManagePageResponse;

  it('preserves existing approval without reading details', async () => {
    const loadDetail = jest.fn();
    expect(
      await resolveManagePageWithdrawApprove({
        managePageData: { ...managePageData, withdrawApprove: approve },
        vault,
        loadDetail,
      }),
    ).toEqual(approve);
    expect(loadDetail).not.toHaveBeenCalled();
  });

  it('reuses fresh details without another request', async () => {
    const loadDetail = jest.fn();
    expect(
      await resolveManagePageWithdrawApprove({
        managePageData,
        vault: vault.toLowerCase(),
        detailCacheEntry: { data: detail, updatedAt: Date.now() },
        loadDetail,
      }),
    ).toEqual(approve);
    expect(loadDetail).not.toHaveBeenCalled();
  });

  it.each([undefined, Date.now() - 60_001, Date.now() + 60_000])(
    'loads details when the cache is absent or invalid (%s)',
    async (updatedAt) => {
      const loadDetail = jest.fn().mockResolvedValue(detail);
      expect(
        await resolveManagePageWithdrawApprove({
          managePageData,
          vault,
          detailCacheEntry:
            updatedAt === undefined ? undefined : { data: detail, updatedAt },
          loadDetail,
        }),
      ).toEqual(approve);
      expect(loadDetail).toHaveBeenCalledTimes(1);
    },
  );

  it('does not reuse a different vault approval', async () => {
    const loadDetail = jest.fn().mockResolvedValue(detail);
    const cached = {
      withdrawApprove: { ...approve, tokenAddress: '0xOtherVault' },
    } as IStakeEarnDetail;
    expect(
      await resolveManagePageWithdrawApprove({
        managePageData,
        vault,
        detailCacheEntry: { data: cached, updatedAt: Date.now() },
        loadDetail,
      }),
    ).toEqual(approve);
    expect(loadDetail).toHaveBeenCalledTimes(1);
  });

  it.each([
    { vault: undefined, page: managePageData },
    { vault: '0xOtherVault', page: managePageData },
    { vault, page: {} },
    {
      vault,
      page: { ...managePageData, deposit: managePageData.withdraw },
    },
    {
      vault,
      page: { ...managePageData, buy: {} },
    },
  ])('does not fetch details for other flows (%s)', async (params) => {
    const loadDetail = jest.fn();
    expect(
      await resolveManagePageWithdrawApprove({
        managePageData: params.page as IEarnManagePageResponse,
        vault: params.vault,
        loadDetail,
      }),
    ).toBeUndefined();
    expect(loadDetail).not.toHaveBeenCalled();
  });

  it.each([
    {},
    { withdrawApprove: { ...approve, approveTarget: undefined } },
    { withdrawApprove: { ...approve, tokenAddress: '0xOtherVault' } },
    { withdrawApprove: { ...approve, amountUnit: undefined } },
  ])(
    'rejects an incomplete receipt withdrawal configuration (%s)',
    async (value) => {
      await expect(
        resolveManagePageWithdrawApprove({
          managePageData,
          vault,
          loadDetail: jest.fn().mockResolvedValue(value),
        }),
      ).rejects.toThrow('Receipt token withdrawal approval is missing');
    },
  );

  it('propagates detail failures instead of using the input asset', async () => {
    await expect(
      resolveManagePageWithdrawApprove({
        managePageData,
        vault,
        loadDetail: jest.fn().mockRejectedValue(new Error('unavailable')),
      }),
    ).rejects.toThrow('unavailable');
  });
});
