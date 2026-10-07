import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Divider,
  Icon,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useNavigateToRewardHistory } from '@onekeyhq/kit/src/views/ReferFriends/pages/RewardDistributionHistory/hooks/useNavigateToRewardHistory';
import { useNavigateToYourReferred } from '@onekeyhq/kit/src/views/ReferFriends/pages/YourReferred/hooks';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IInviteSummary } from '@onekeyhq/shared/src/referralCode/type';

import { ReferFriendsTestIDs } from '../../../testIDs';
import { INVITE_COPY } from '../inviteCopy';

import { getInviteEarningsState } from './getInviteEarningsState';
import { useNextDistributionLabel } from './useNextDistributionLabel';

function CardTextAction({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <XStack
      testID={testID}
      ai="center"
      gap="$0.5"
      cursor="pointer"
      role="button"
      onPress={onPress}
    >
      <SizableText size="$bodyMd" color="$textSubdued">
        {label}
      </SizableText>
      <Icon name="ChevronRightSmallOutline" size="$4" color="$iconSubdued" />
    </XStack>
  );
}

function EarningsTotals({
  cumulativeLabel,
  distributedLabel,
  cumulative,
  distributed,
}: {
  cumulativeLabel: string;
  distributedLabel: string;
  cumulative: string;
  distributed: string;
}) {
  return (
    <XStack ai="center" gap="$1" flexWrap="wrap">
      <SizableText size="$bodySm" color="$textSubdued">
        {cumulativeLabel}
      </SizableText>
      <Currency size="$bodySmMedium">{cumulative}</Currency>
      <SizableText size="$bodySm" color="$textSubdued">
        ·
      </SizableText>
      <SizableText size="$bodySm" color="$textSubdued">
        {distributedLabel}
      </SizableText>
      <Currency size="$bodySmMedium">{distributed}</Currency>
    </XStack>
  );
}

type IInviteEarnings = ReturnType<typeof getInviteEarningsState>;

interface IEarningsLabels {
  undistributed: string;
  distributed: string;
  cumulative: string;
  nextDistribution: string;
  referred: string;
  history: string;
}

// Desktop keeps the earnings to a single summary line beside the invite card.
function DesktopEarningsSummary({
  earnings,
  labels,
  onOpenReferred,
  onOpenHistory,
}: {
  earnings: IInviteEarnings;
  labels: IEarningsLabels;
  onOpenReferred: () => void;
  onOpenHistory: () => void;
}) {
  return (
    <XStack ai="center" gap="$4" flexWrap="wrap">
      <XStack flex={1} ai="center" gap="$1" flexWrap="wrap">
        <SizableText size="$bodyMd" color="$textSubdued">
          {labels.undistributed}
        </SizableText>
        <Currency size="$bodyMdMedium">{earnings.undistributed}</Currency>
        <SizableText size="$bodyMd" color="$textSubdued">
          ·
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          {labels.distributed}
        </SizableText>
        <Currency size="$bodyMdMedium">{earnings.distributed}</Currency>
        {earnings.nextDistribution ? (
          <SizableText size="$bodyMd" color="$textSubdued">
            {`· ${labels.nextDistribution} ${earnings.nextDistribution}`}
          </SizableText>
        ) : null}
      </XStack>
      <CardTextAction
        testID={ReferFriendsTestIDs.inviteYourReferred}
        label={labels.referred}
        onPress={onOpenReferred}
      />
      <CardTextAction
        testID={ReferFriendsTestIDs.inviteRewardHistory}
        label={labels.history}
        onPress={onOpenHistory}
      />
    </XStack>
  );
}

function CompactEarnings({
  earnings,
  labels,
  onOpenReferred,
  onOpenHistory,
}: {
  earnings: IInviteEarnings;
  labels: IEarningsLabels;
  onOpenReferred: () => void;
  onOpenHistory: () => void;
}) {
  return (
    <YStack gap="$2">
      <XStack jc="flex-end">
        <CardTextAction
          testID={ReferFriendsTestIDs.inviteYourReferred}
          label={labels.referred}
          onPress={onOpenReferred}
        />
      </XStack>
      {earnings.isZero ? (
        <ListItem
          testID={ReferFriendsTestIDs.inviteRewardHistory}
          mx="$0"
          px="$0"
          title={labels.undistributed}
          drillIn
          onPress={onOpenHistory}
        >
          <Currency size="$bodyMdMedium">{earnings.undistributed}</Currency>
        </ListItem>
      ) : (
        <>
          <SizableText size="$bodyMd" color="$textSubdued">
            {labels.undistributed}
          </SizableText>
          <Currency size="$headingMd">{earnings.undistributed}</Currency>
          {earnings.nextDistribution ? (
            <SizableText size="$bodySm" color="$textSubdued">
              {`${labels.nextDistribution} ${earnings.nextDistribution}`}
            </SizableText>
          ) : null}
          <Divider />
          <EarningsTotals
            cumulativeLabel={labels.cumulative}
            distributedLabel={labels.distributed}
            cumulative={earnings.cumulative}
            distributed={earnings.distributed}
          />
          <ListItem
            testID={ReferFriendsTestIDs.inviteRewardHistory}
            mx="$0"
            px="$0"
            title={labels.history}
            drillIn
            onPress={onOpenHistory}
          />
        </>
      )}
    </YStack>
  );
}

export function InviteEarningsCard({
  summaryInfo,
}: {
  summaryInfo: IInviteSummary;
}) {
  const intl = useIntl();
  const { md } = useMedia();
  const navigateToRewardHistory = useNavigateToRewardHistory();
  const navigateToYourReferred = useNavigateToYourReferred();
  const nextDistribution = useNextDistributionLabel(
    summaryInfo.cumulativeRewards.nextDistribution,
  );
  const earnings = useMemo(
    () => ({
      ...getInviteEarningsState(summaryInfo.cumulativeRewards),
      nextDistribution,
    }),
    [nextDistribution, summaryInfo.cumulativeRewards],
  );
  const labels: IEarningsLabels = {
    undistributed: intl.formatMessage({
      id: ETranslations.referral_undistributed,
    }),
    distributed: intl.formatMessage({ id: ETranslations.referral_distributed }),
    cumulative: INVITE_COPY.totalEarned,
    nextDistribution: intl.formatMessage({
      id: ETranslations.referral_next_distribution,
    }),
    referred: intl.formatMessage({ id: ETranslations.referral_referral_list }),
    history: intl.formatMessage({ id: ETranslations.referral_reward_history }),
  };
  const EarningsBody = md ? CompactEarnings : DesktopEarningsSummary;

  return (
    <YStack
      testID={ReferFriendsTestIDs.inviteEarningsCard}
      borderWidth={1}
      borderColor="$borderSubdued"
      borderRadius="$3"
      bg="$bgSubdued"
      p="$4"
    >
      <EarningsBody
        earnings={earnings}
        labels={labels}
        onOpenReferred={navigateToYourReferred}
        onOpenHistory={navigateToRewardHistory}
      />
    </YStack>
  );
}
