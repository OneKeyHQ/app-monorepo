import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EReplaceTxType } from '@onekeyhq/shared/types/tx';

import ServiceStaking from './ServiceStaking';

const stakeTag = 'borrow:aave:setCollateral';

function createPendingTx(
  id: string,
  replacedType?: EReplaceTxType,
): IAccountHistoryTx {
  return {
    id,
    replacedType,
    stakingInfo: { tags: [stakeTag] },
  } as unknown as IAccountHistoryTx;
}

describe('ServiceStaking.fetchLocalStakingHistory', () => {
  const previousBackgroundScope = globalThis.$onekeyIsInBackground;

  beforeAll(() => {
    globalThis.$onekeyIsInBackground = true;
  });

  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
  });

  it('excludes cancellation replacements that inherited staking metadata', async () => {
    const activeTx = createPendingTx('active');
    const cancelledTx = createPendingTx('cancelled', EReplaceTxType.Cancel);
    const unrelatedTx = {
      ...createPendingTx('unrelated'),
      stakingInfo: { tags: ['another-tag'] },
    };
    const backgroundApi = {
      serviceAccount: {
        getAccountXpub: jest.fn().mockResolvedValue(undefined),
        getAccountAddressForApi: jest.fn().mockResolvedValue('0xaccount'),
      },
      serviceHistory: {
        getAccountLocalHistoryPendingTxs: jest
          .fn()
          .mockResolvedValue([cancelledTx, activeTx, unrelatedTx]),
      },
    };
    const service = new ServiceStaking({ backgroundApi });

    await expect(
      service.fetchLocalStakingHistory({
        accountId: 'account-id',
        networkId: 'evm--1',
        stakeTag,
      }),
    ).resolves.toEqual([activeTx]);
  });

  it('returns a stable opaque identity for the actual filtered history query', async () => {
    const activeTx = createPendingTx('active');
    const cancelledTx = createPendingTx('cancelled', EReplaceTxType.Cancel);
    const unrelatedTx = {
      ...createPendingTx('unrelated'),
      stakingInfo: { tags: ['another-tag'] },
    };
    const query = jest
      .fn()
      .mockResolvedValue([activeTx, cancelledTx, unrelatedTx]);
    const getXpub = jest.fn().mockResolvedValue('xpub-a');
    const getAddress = jest.fn().mockResolvedValue('address-a');
    const service = new ServiceStaking({
      backgroundApi: {
        serviceAccount: {
          getAccountXpub: getXpub,
          getAccountAddressForApi: getAddress,
        },
        serviceHistory: { getAccountLocalHistoryPendingTxs: query },
      },
    });

    const params = { accountId: 'account-id', networkId: 'evm--1', stakeTag };
    const result = await service.fetchLocalStakingHistoryWithAccount(params);
    expect(result).toEqual({
      accountIdentity: expect.stringMatching(/^[0-9a-f]{64}$/),
      txs: [activeTx],
    });
    expect(JSON.stringify(result)).not.toContain('xpub-a');
    expect(JSON.stringify(result)).not.toContain('address-a');
    expect(query).toHaveBeenCalledWith({
      networkId: 'evm--1',
      accountAddress: 'address-a',
      xpub: 'xpub-a',
    });
    expect(
      (await service.fetchLocalStakingHistoryWithAccount(params))
        .accountIdentity,
    ).toBe(result.accountIdentity);
    expect(
      (
        await service.fetchLocalStakingHistoryWithAccount({
          ...params,
          accountId: 'account-b',
        })
      ).accountIdentity,
    ).not.toBe(result.accountIdentity);
    expect(
      (
        await service.fetchLocalStakingHistoryWithAccount({
          ...params,
          networkId: 'evm--10',
        })
      ).accountIdentity,
    ).not.toBe(result.accountIdentity);
    getAddress.mockResolvedValue('address-b');
    expect(
      (await service.fetchLocalStakingHistoryWithAccount(params))
        .accountIdentity,
    ).not.toBe(result.accountIdentity);
    getAddress.mockResolvedValue('address-a');
    getXpub.mockResolvedValue('xpub-b');
    expect(
      (await service.fetchLocalStakingHistoryWithAccount(params))
        .accountIdentity,
    ).not.toBe(result.accountIdentity);
    getXpub.mockResolvedValue(undefined);
    getAddress.mockResolvedValue('');
    expect(
      (await service.fetchLocalStakingHistoryWithAccount(params))
        .accountIdentity,
    ).toBeUndefined();
  });

  it.each(['address', 'xpub', 'history'] as const)(
    'propagates %s query errors for both interfaces',
    async (failedQuery) => {
      const failure = new Error('query failed');
      const getAddress = jest.fn().mockResolvedValue('address-a');
      const getXpub = jest.fn().mockResolvedValue('xpub-a');
      const getHistory = jest.fn().mockResolvedValue([]);
      if (failedQuery === 'address') getAddress.mockRejectedValue(failure);
      if (failedQuery === 'xpub') getXpub.mockRejectedValue(failure);
      if (failedQuery === 'history') getHistory.mockRejectedValue(failure);
      const service = new ServiceStaking({
        backgroundApi: {
          serviceAccount: {
            getAccountXpub: getXpub,
            getAccountAddressForApi: getAddress,
          },
          serviceHistory: { getAccountLocalHistoryPendingTxs: getHistory },
        },
      });
      const params = { accountId: 'account-id', networkId: 'evm--1', stakeTag };
      await expect(service.fetchLocalStakingHistory(params)).rejects.toThrow(
        failure,
      );
      await expect(
        service.fetchLocalStakingHistoryWithAccount(params),
      ).rejects.toThrow(failure);
    },
  );
});
