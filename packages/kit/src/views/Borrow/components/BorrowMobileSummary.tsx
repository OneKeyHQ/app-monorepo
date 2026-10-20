import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { DashText, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IEarnText, IEarnTooltip } from '@onekeyhq/shared/types/staking';

import { EarnTooltip } from '../../Staking/components/ProtocolDetails/EarnTooltip';
import { useBorrowContext } from '../BorrowProvider';

import { BorrowBonusMetric } from './BorrowBonusMetric';
import { BorrowRewardsMetric } from './BorrowRewardsMetric';
import { OverviewMetric } from './OverviewMetric';

import type { IBorrowOverviewData } from '../hooks/useBorrowOverviewData';

type IApyWithTooltip = { title: IEarnText; tooltip?: IEarnTooltip };

function ApyDetail({ apy }: { apy?: IApyWithTooltip }) {
  if (!apy?.title) {
    return null;
  }

  const color = apy.title.color ?? '$textSubdued';
  const size = apy.title.size ?? '$bodyMd';

  if (!apy.tooltip) {
    return (
      <SizableText size={size} color={color}>
        {apy.title.text}
      </SizableText>
    );
  }

  return (
    <EarnTooltip
      tooltip={apy.tooltip}
      renderTrigger={
        <DashText size={size} color={color} dashColor={color} dashThickness={1}>
          {apy.title.text}
        </DashText>
      }
    />
  );
}

function BalanceMetric({
  label,
  balance,
  apy,
  isLoading,
}: {
  label: string;
  balance?: { title: IEarnText };
  apy?: IApyWithTooltip;
  isLoading?: boolean;
}) {
  if (!balance?.title && !isLoading) {
    return null;
  }
  return (
    <OverviewMetric
      title={{ text: label }}
      text={balance?.title}
      action={isLoading ? undefined : <ApyDetail apy={apy} />}
      isLoading={isLoading}
      valueLayout="stacked"
    />
  );
}

/** Counts what is actually in the groups: a group with no items behind it
 * opens a claim dialog with nothing to claim. */
function hasRewardItems(groups?: { items: unknown[] }[] | null) {
  return Boolean(groups?.some((group) => group.items.length > 0));
}

export function BorrowMobileSummary({
  overviewData,
  showPositionTotals = true,
  isPositionTotalsLoading = false,
}: {
  overviewData: IBorrowOverviewData;
  showPositionTotals?: boolean;
  isPositionTotalsLoading?: boolean;
}) {
  const intl = useIntl();
  const { reserves } = useBorrowContext();
  const { borrowRewards, isRewardsLoading, isRewardsError, requestRefresh } =
    overviewData;

  const supplied = reserves.data?.supplied;
  const borrowed = reserves.data?.borrowed;

  const showTotals = showPositionTotals || isPositionTotalsLoading;
  // The remaining two stand on their own data rather than on the positions
  // above them. Rewards in particular outlive the position that earned them —
  // withdrawing everything still leaves a claim to make, and that claim is
  // reached through this metric — so gating them on the position list would
  // hide a working Claim button. The bonus rides the same reserves payload as
  // the totals, hence the shared pending flag.
  const showBonus =
    Boolean(reserves.data?.overview?.platformBonus) || isPositionTotalsLoading;
  // The rewards payload still arrives when there is nothing to collect — a
  // zero-valued object rather than an absent one — so its presence answers
  // nothing, and neither does button.disabled: the claim dialog is built from
  // these two lists alone and counts the items inside the groups to decide it
  // has anything to show. A claim left enabled over an empty payload opens a
  // dialog with nothing in it, so the lists are what the cell follows.
  const rewardsDetail = borrowRewards?.button?.data?.rewardsDetail;
  const showRewards =
    hasRewardItems(rewardsDetail?.claimable) ||
    hasRewardItems(rewardsDetail?.unclaimable) ||
    isRewardsLoading ||
    isRewardsError;

  // Otherwise the frame below is a rule drawn across the page with nothing
  // under it.
  if (!showTotals && !showBonus && !showRewards) {
    return null;
  }

  return (
    <YStack
      pt="$4"
      gap="$2"
      borderTopWidth={StyleSheet.hairlineWidth}
      borderTopColor="$borderSubdued"
    >
      <XStack flexWrap="wrap" mx="$-3" pl="$4">
        {showTotals ? (
          <>
            <BalanceMetric
              label={intl.formatMessage({
                id: ETranslations.defi_supplied_balance,
              })}
              balance={supplied?.suppliedBalance}
              apy={supplied?.suppliedApy}
              isLoading={isPositionTotalsLoading}
            />
            <BalanceMetric
              label={intl.formatMessage({
                id: ETranslations.defi_borrowed_balance,
              })}
              balance={borrowed?.borrowedBalance}
              apy={borrowed?.borrowedApy}
              isLoading={isPositionTotalsLoading}
            />
          </>
        ) : null}
        {showBonus ? <BorrowBonusMetric /> : null}
        {showRewards ? (
          <BorrowRewardsMetric
            borrowRewards={borrowRewards}
            isError={isRewardsError}
            isLoading={isRewardsLoading}
            onClaimed={requestRefresh}
          />
        ) : null}
      </XStack>
    </YStack>
  );
}
