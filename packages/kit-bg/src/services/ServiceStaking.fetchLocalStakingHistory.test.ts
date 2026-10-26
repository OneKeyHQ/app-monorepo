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
    const backgroundApi = {
      serviceAccount: {
        getAccountXpub: jest.fn().mockResolvedValue(undefined),
        getAccountAddressForApi: jest.fn().mockResolvedValue('0xaccount'),
      },
      serviceHistory: {
        getAccountLocalHistoryPendingTxs: jest
          .fn()
          .mockResolvedValue([cancelledTx, activeTx]),
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
});
