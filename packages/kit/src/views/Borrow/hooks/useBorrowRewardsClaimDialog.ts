import { useCallback, useMemo } from 'react';

import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';
import type { IBorrowRewards } from '@onekeyhq/shared/types/staking';

import { buildBorrowTag } from '../../Staking/utils/utils';
import { showBorrowClaimRewardsDialog } from '../components/BorrowClaimRewardsDialog';
import { getPendingBorrowClaimIds } from '../components/BorrowRewardsMetric.utils';

import { useUniversalBorrowClaim } from './useUniversalBorrowHooks';

import type { IStakePendingTx } from '../../Earn/hooks/useStakingPendingTxs';

type IBorrowRewardsMarket = {
  provider: string;
  networkId: string;
  marketAddress: string;
  logoURI?: string;
};

/**
 * A market's rewards window: what the account can claim there, each reward
 * with its own Claim and one for all of them, a claim already out shown
 * busy. The market page's Rewards cell and My portfolio's lending card open
 * the same one
 */
export function useBorrowRewardsClaimDialog({
  market,
  accountId,
  borrowRewards,
  pendingTxs,
  isError = false,
  onClaimed,
}: {
  market?: IBorrowRewardsMarket | null;
  /** the account's own account on the market's network */
  accountId?: string;
  borrowRewards?: IBorrowRewards | null;
  pendingTxs: readonly IStakePendingTx[];
  isError?: boolean;
  onClaimed: () => void | Promise<void>;
}) {
  const provider = market?.provider;
  const networkId = market?.networkId;
  const marketAddress = market?.marketAddress;
  const marketLogoURI = market?.logoURI;

  const pendingClaimIds = useMemo<string[]>(() => {
    if (!accountId || !networkId || !provider || !marketAddress) {
      return [];
    }
    return getPendingBorrowClaimIds({
      pendingTxs,
      accountId,
      networkId,
      provider,
      marketAddress,
    });
  }, [accountId, marketAddress, networkId, pendingTxs, provider]);

  const handleBorrowClaim = useUniversalBorrowClaim({
    networkId: networkId ?? '',
    accountId: accountId ?? '',
  });

  const openRewardsDialog = useCallback(() => {
    if (
      isError ||
      !borrowRewards?.button ||
      !provider ||
      !marketAddress ||
      !networkId ||
      !accountId
    )
      return;

    const rewardsDetails = borrowRewards.button;
    const claimableGroups = rewardsDetails.data.rewardsDetail.claimable ?? [];
    const pendingIdSet = new Set(pendingClaimIds);
    const allIds: string[] = [];
    for (const group of claimableGroups) {
      for (const item of group.items) {
        if (!pendingIdSet.has(item.id)) {
          allIds.push(item.id);
        }
      }
    }

    const buildStakingInfo = (claimIds: string[]) => ({
      label: EEarnLabels.Claim,
      protocol: earnUtils.getEarnProviderName({ providerName: provider }),
      protocolLogoURI: marketLogoURI,
      tags: [
        EEarnLabels.Borrow,
        buildBorrowTag({
          provider,
          action: 'claim',
          claimIds,
          claimScope: {
            networkId,
            marketAddress,
          },
        }),
      ],
    });

    showBorrowClaimRewardsDialog({
      rewardsDetails,
      pendingClaimIds,
      onClaimItem: async (item) =>
        handleBorrowClaim({
          provider,
          marketAddress,
          ids: [item.id],
          stakingInfo: buildStakingInfo([item.id]),
          onSuccess: () => {
            void onClaimed();
          },
        }),
      onClaimAll: async () => {
        if (allIds.length === 0) {
          return false;
        }
        return handleBorrowClaim({
          provider,
          marketAddress,
          ids: allIds,
          stakingInfo: buildStakingInfo(allIds),
          onSuccess: () => {
            void onClaimed();
          },
        });
      },
    });
  }, [
    isError,
    borrowRewards?.button,
    provider,
    marketAddress,
    networkId,
    accountId,
    marketLogoURI,
    handleBorrowClaim,
    pendingClaimIds,
    onClaimed,
  ]);

  return { openRewardsDialog, pendingClaimIds };
}
