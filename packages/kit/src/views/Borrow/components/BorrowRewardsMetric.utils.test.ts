import { EEarnLabels } from '@onekeyhq/shared/types/staking';

import { buildBorrowTag } from '../../Staking/utils/utils';

import {
  type IBorrowPendingClaimTx,
  getPendingBorrowClaimIds,
} from './BorrowRewardsMetric.utils';

const CURRENT_ACCOUNT_ID = 'account-1';
const CURRENT_NETWORK_ID = 'evm--1';
const CURRENT_PROVIDER = 'Aave';
const CURRENT_MARKET_ADDRESS = '0xAbCd';

function buildPendingTx({
  accountId = CURRENT_ACCOUNT_ID,
  networkId = CURRENT_NETWORK_ID,
  provider = CURRENT_PROVIDER,
  marketAddress = CURRENT_MARKET_ADDRESS,
  action = 'claim',
  claimIds = ['shared-id'],
}: {
  accountId?: string;
  networkId?: string;
  provider?: string;
  marketAddress?: string;
  action?: Parameters<typeof buildBorrowTag>[0]['action'];
  claimIds?: string[];
} = {}): IBorrowPendingClaimTx {
  return {
    decodedTx: {
      accountId,
      networkId,
    },
    stakingInfo: {
      label: EEarnLabels.Claim,
      tags: [
        buildBorrowTag({
          provider,
          action,
          claimIds,
          claimScope: {
            networkId,
            marketAddress,
          },
        }),
      ],
    },
  };
}

function getCurrentPendingIds(pendingTxs: IBorrowPendingClaimTx[]) {
  return getPendingBorrowClaimIds({
    pendingTxs,
    accountId: CURRENT_ACCOUNT_ID,
    networkId: CURRENT_NETWORK_ID,
    provider: CURRENT_PROVIDER,
    marketAddress: CURRENT_MARKET_ADDRESS,
  });
}

describe('getPendingBorrowClaimIds', () => {
  it('returns IDs only for the current claim scope', () => {
    expect(
      getCurrentPendingIds([
        buildPendingTx({ claimIds: ['current-2', 'current-1'] }),
      ]),
    ).toEqual(['current-1', 'current-2']);
  });

  it('ignores ID collisions from other networks and providers', () => {
    expect(
      getCurrentPendingIds([
        buildPendingTx({
          networkId: 'evm--137',
          claimIds: ['shared-id'],
        }),
        buildPendingTx({
          provider: 'Compound',
          claimIds: ['shared-id'],
        }),
      ]),
    ).toEqual([]);
  });

  it('ignores an ID collision from a different market of the same provider', () => {
    expect(
      getCurrentPendingIds([
        buildPendingTx({
          marketAddress: '0xDifferentMarket',
          claimIds: ['shared-id'],
        }),
      ]),
    ).toEqual([]);
  });

  it('matches EVM market addresses case-insensitively', () => {
    expect(
      getCurrentPendingIds([
        buildPendingTx({
          marketAddress: CURRENT_MARKET_ADDRESS.toLowerCase(),
          claimIds: ['current-id'],
        }),
      ]),
    ).toEqual(['current-id']);
  });

  it('ignores other accounts and actions', () => {
    expect(
      getCurrentPendingIds([
        buildPendingTx({
          accountId: 'account-2',
          claimIds: ['other-account-id'],
        }),
        buildPendingTx({
          action: 'supply',
          claimIds: ['other-action-id'],
        }),
      ]),
    ).toEqual([]);
  });

  it('conservatively matches a legacy claim within the current owner scope', () => {
    const legacyClaimTx = buildPendingTx();
    legacyClaimTx.stakingInfo.tags = [
      buildBorrowTag({
        provider: CURRENT_PROVIDER,
        action: 'claim',
        claimIds: ['legacy-id'],
      }),
    ];

    expect(getCurrentPendingIds([legacyClaimTx])).toEqual(['legacy-id']);
  });
});
