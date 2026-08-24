import type { IEarnSummaryV2 } from '@onekeyhq/shared/types/staking';

import { loadEarnInviteeReward } from './utils';

const ethNetworkId = 'evm--1';

const rebateData: IEarnSummaryV2 = {
  title: { text: 'Referral bonus' },
  description: { text: 'Paid monthly' },
  distributed: [],
  undistributed: [],
};

describe('loadEarnInviteeReward', () => {
  test('returns no-wallet when neither account id is present', async () => {
    const getEarnAccount = jest.fn();
    const getEarnSummaryV2 = jest.fn();

    await expect(
      loadEarnInviteeReward({
        dependencies: {
          ethNetworkId,
          getEarnAccount,
          getEarnSummaryV2,
        },
      }),
    ).resolves.toEqual({ status: 'no-wallet' });

    expect(getEarnAccount).not.toHaveBeenCalled();
  });

  test('returns unsupported when the earn account has no EVM address', async () => {
    const getEarnAccount = jest.fn().mockResolvedValue(null);
    const getEarnSummaryV2 = jest.fn();

    await expect(
      loadEarnInviteeReward({
        accountId: 'hd-1--account',
        dependencies: {
          ethNetworkId,
          getEarnAccount,
          getEarnSummaryV2,
        },
      }),
    ).resolves.toEqual({ status: 'unsupported' });

    expect(getEarnSummaryV2).not.toHaveBeenCalled();
  });

  test('loads rebate data for the current EVM account', async () => {
    const earnAccount = {
      accountId: 'hd-1--eth',
      accountAddress: '0xabc',
    };
    const getEarnAccount = jest.fn().mockResolvedValue(earnAccount);
    const getEarnSummaryV2 = jest.fn().mockResolvedValue(rebateData);

    await expect(
      loadEarnInviteeReward({
        accountId: 'hd-1--account',
        indexedAccountId: 'hd-1--0',
        dependencies: {
          ethNetworkId,
          getEarnAccount,
          getEarnSummaryV2,
        },
      }),
    ).resolves.toEqual({
      status: 'success',
      data: rebateData,
      earnAccount,
    });

    expect(getEarnAccount).toHaveBeenCalledWith({
      accountId: 'hd-1--account',
      indexedAccountId: 'hd-1--0',
      networkId: ethNetworkId,
      btcOnlyTaproot: true,
    });
    expect(getEarnSummaryV2).toHaveBeenCalledWith({
      accountAddress: '0xabc',
      networkId: ethNetworkId,
    });
  });

  test('returns an error state when the rebate request fails', async () => {
    const getEarnAccount = jest.fn().mockResolvedValue({
      accountId: 'hd-1--eth',
      accountAddress: '0xabc',
    });
    const getEarnSummaryV2 = jest
      .fn()
      .mockRejectedValue(new Error('request failed'));

    await expect(
      loadEarnInviteeReward({
        accountId: 'hd-1--account',
        dependencies: {
          ethNetworkId,
          getEarnAccount,
          getEarnSummaryV2,
        },
      }),
    ).resolves.toEqual({ status: 'error' });
  });
});
