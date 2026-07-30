import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Button } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';
import type { IBorrowRewards } from '@onekeyhq/shared/types/staking';

import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';
import {
  buildBorrowTag,
  isBorrowTag,
  parseBorrowTag,
} from '../../Staking/utils/utils';
import { getBorrowEarnAccountId } from '../borrowEarnAccount';
import { useBorrowContext } from '../BorrowProvider';
import { useBorrowPlaceholderAmountText } from '../hooks/useBorrowPlaceholderAmountText';
import { useUniversalBorrowClaim } from '../hooks/useUniversalBorrowHooks';
import { BorrowTestIDs } from '../testIDs';

import { showBorrowClaimRewardsDialog } from './BorrowClaimRewardsDialog';
import { OverviewMetric } from './OverviewMetric';

import type { IOverviewMetricProps } from './OverviewMetric';

/**
 * Claimable rewards as one cell of the overview strip, with the claim dialog
 * behind the value. Lives in its own component because the cell sits at the top
 * of the page on desktop and in the summary below the positions on phones.
 */
export function BorrowRewardsMetric({
  borrowRewards,
  isLoading,
  onClaimed,
  widthMode,
}: {
  borrowRewards?: IBorrowRewards | null;
  isLoading?: boolean;
  onClaimed: () => void | Promise<void>;
  widthMode?: IOverviewMetricProps['widthMode'];
}) {
  const intl = useIntl();
  const placeholderAmountText = useBorrowPlaceholderAmountText();
  const { market, earnAccount, pendingTxs } = useBorrowContext();

  const provider = market?.provider;
  const networkId = market?.networkId;
  const marketAddress = market?.marketAddress;
  const earnAccountId = getBorrowEarnAccountId(earnAccount.data);

  const pendingClaimIds = useMemo(
    () =>
      pendingTxs
        .filter((tx) => tx.stakingInfo.label === EEarnLabels.Claim)
        .flatMap((tx) => {
          const tags = tx.stakingInfo.tags ?? [];
          return tags.flatMap((tag) => {
            if (isBorrowTag(tag)) {
              const parsed = parseBorrowTag(tag);
              return parsed?.claimIds ?? [];
            }
            return [];
          });
        }),
    [pendingTxs],
  );

  const handleBorrowClaim = useUniversalBorrowClaim({
    networkId: networkId ?? '',
    accountId: earnAccountId ?? '',
  });

  const handleShowRewardsDialog = useCallback(() => {
    if (
      !borrowRewards?.button ||
      !provider ||
      !marketAddress ||
      !networkId ||
      !earnAccountId
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
      protocolLogoURI: market?.logoURI,
      tags: [
        EEarnLabels.Borrow,
        buildBorrowTag({ provider, action: 'claim', claimIds }),
      ],
    });

    showBorrowClaimRewardsDialog({
      rewardsDetails,
      pendingClaimIds,
      onClaimItem: async (item) => {
        await handleBorrowClaim({
          provider,
          marketAddress,
          ids: [item.id],
          stakingInfo: buildStakingInfo([item.id]),
          onSuccess: () => {
            void onClaimed();
          },
        });
      },
      onClaimAll: async () => {
        if (allIds.length === 0) {
          return;
        }
        await handleBorrowClaim({
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
    borrowRewards?.button,
    provider,
    marketAddress,
    networkId,
    earnAccountId,
    market?.logoURI,
    handleBorrowClaim,
    pendingClaimIds,
    onClaimed,
  ]);

  return (
    <OverviewMetric
      title={
        borrowRewards?.title ?? {
          text: intl.formatMessage({
            id: ETranslations.defi_claimable_rewards,
          }),
        }
      }
      text={borrowRewards?.description ?? placeholderAmountText}
      isLoading={Boolean(isLoading && !borrowRewards)}
      widthMode={widthMode}
      action={
        borrowRewards && !borrowRewards.button.disabled ? (
          <Button
            testID={BorrowTestIDs.overviewClaimRewardsBtn}
            p="0"
            ai="center"
            size="small"
            variant="link"
            onPress={handleShowRewardsDialog}
          >
            <EarnText
              size="$bodyMdMedium"
              color="$textInfo"
              text={borrowRewards.button.text}
            />
          </Button>
        ) : null
      }
    />
  );
}
