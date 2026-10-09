import { useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Divider,
  Icon,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { ISizableTextProps } from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useNavigateToEditAddress } from '@onekeyhq/kit/src/views/ReferFriends/pages/EditAddress/hooks/useNavigateToEditAddress';
import { useNavigateToRewardHistory } from '@onekeyhq/kit/src/views/ReferFriends/pages/RewardDistributionHistory/hooks/useNavigateToRewardHistory';
import { openInviteWithdrawAddressEditor } from '@onekeyhq/kit/src/views/ReferFriends/pages/RewardDistributionHistory/openInviteWithdrawAddressEditor';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IInviteSummary } from '@onekeyhq/shared/src/referralCode/type';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { ReferFriendsTestIDs } from '../../../testIDs';
import { INVITE_COPY } from '../inviteCopy';

import { getInviteEarningsState } from './getInviteEarningsState';
import { REFERRAL_USD_CURRENCY_PROPS } from './shared/getRewardSummary';
import {
  COMPACT_ENTRY_TITLE_PROPS,
  COMPACT_ROW_BLEED_PROPS,
  INVITE_CARD_BORDER_COLOR,
  PRESSABLE_SURFACE_PROPS,
  useInviteHomeCardStyle,
} from './useInviteCardStyle';
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
    <Button
      testID={testID}
      variant="tertiary"
      size="small"
      iconAfter="ChevronRightSmallOutline"
      onPress={onPress}
    >
      {label}
    </Button>
  );
}

type IInviteEarnings = ReturnType<typeof getInviteEarningsState>;

interface IEarningsLabels {
  undistributed: string;
  distributed: string;
  cumulative: string;
  nextDistribution: string;
  history: string;
  payoutAddress: string;
}

// The unpaid figure, optionally with its fixed "USD" unit (it stays in USD
// whatever the wallet currency is), and the next payout date.
function UnpaidAmount({
  amount,
  nextPayout,
  nextPayoutLabel,
  amountSize,
  unitSize,
  hintSize,
}: {
  amount: string;
  nextPayout: string | null;
  nextPayoutLabel: string;
  amountSize: ISizableTextProps['size'];
  // Omitted on compact layouts, where every figure on the page reads "$".
  unitSize?: ISizableTextProps['size'];
  hintSize: ISizableTextProps['size'];
}) {
  return (
    <YStack gap="$1">
      <XStack ai="baseline" gap="$1.5">
        <Currency
          {...REFERRAL_USD_CURRENCY_PROPS}
          size={amountSize}
          numberOfLines={1}
          flexShrink={1}
        >
          {amount}
        </Currency>
        {unitSize ? (
          <SizableText size={unitSize} color="$textSubdued">
            USD
          </SizableText>
        ) : null}
      </XStack>
      {nextPayout ? (
        <SizableText size={hintSize} color="$textSubdued">
          {`${nextPayoutLabel} ${nextPayout}`}
        </SizableText>
      ) : null}
    </YStack>
  );
}

function StatCell({
  label,
  children,
  onPress,
  testID,
}: {
  label: string;
  children: ReactNode;
  onPress?: () => void;
  testID?: string;
}) {
  return (
    <XStack
      testID={testID}
      flex={1}
      ai="center"
      gap="$2"
      py="$1"
      borderRadius="$2"
      // Pressable cells get a padded hover surface that keeps text aligned.
      {...(onPress ? { ...PRESSABLE_SURFACE_PROPS, mx: -8, px: '$2' } : null)}
      onPress={onPress}
    >
      <YStack flex={1} gap="$1" minWidth={0}>
        <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
          {label}
        </SizableText>
        {children}
      </YStack>
      {onPress ? (
        <Icon name="ChevronRightSmallOutline" size="$5" color="$iconSubdued" />
      ) : null}
    </XStack>
  );
}

// Desktop leads with the unpaid amount, then the totals and payout address.
function DesktopEarnings({
  earnings,
  labels,
  payoutAddress,
  onOpenHistory,
  onEditAddress,
}: {
  earnings: IInviteEarnings;
  labels: IEarningsLabels;
  payoutAddress: string;
  onOpenHistory: () => void;
  onEditAddress: () => void;
}) {
  return (
    <YStack flex={1} gap="$4">
      {/* Grouped by proximity: the label sits right on its amount, the stats
          sit on their divider, and the card's spare height (it stretches to
          the invite card) becomes the gap between the two groups. */}
      <YStack gap="$2">
        <XStack ai="center" jc="space-between" gap="$3">
          <SizableText size="$bodyLgMedium" color="$textSubdued">
            {labels.undistributed}
          </SizableText>
          <CardTextAction
            testID={ReferFriendsTestIDs.inviteRewardHistory}
            label={labels.history}
            onPress={onOpenHistory}
          />
        </XStack>
        <UnpaidAmount
          amount={earnings.undistributed}
          nextPayout={earnings.nextDistribution}
          nextPayoutLabel={labels.nextDistribution}
          amountSize="$heading4xl"
          unitSize="$bodyLg"
          hintSize="$bodyMd"
        />
      </YStack>
      <Divider mt="auto" borderColor={INVITE_CARD_BORDER_COLOR} />
      <XStack ai="center" gap="$4">
        <StatCell label={labels.cumulative}>
          <Currency
            {...REFERRAL_USD_CURRENCY_PROPS}
            size="$headingLg"
            numberOfLines={1}
          >
            {earnings.cumulative}
          </Currency>
        </StatCell>
        <Divider vertical h="$10" borderColor={INVITE_CARD_BORDER_COLOR} />
        <StatCell label={labels.distributed}>
          <Currency
            {...REFERRAL_USD_CURRENCY_PROPS}
            size="$headingLg"
            numberOfLines={1}
          >
            {earnings.distributed}
          </Currency>
        </StatCell>
        <Divider vertical h="$10" borderColor={INVITE_CARD_BORDER_COLOR} />
        <StatCell
          testID={ReferFriendsTestIDs.invitePayoutAddress}
          label={labels.payoutAddress}
          onPress={onEditAddress}
        >
          <SizableText size="$bodyLgMedium" numberOfLines={1}>
            {payoutAddress}
          </SizableText>
        </StatCell>
      </XStack>
    </YStack>
  );
}

// One part of the total on the compact card: a colored dot ties it to the
// total above, and an optional hint sits under the label.
function EarningsPartRow({
  dotColor,
  label,
  value,
  hint,
}: {
  dotColor: string;
  label: string;
  value: string;
  hint?: string | null;
}) {
  return (
    <XStack minHeight={36} ai="center" jc="space-between" gap="$3">
      <XStack flex={1} minWidth={0} ai="flex-start" gap="$2">
        <YStack h={20} jc="center">
          <YStack w="$2" h="$2" borderRadius="$full" bg={dotColor} />
        </YStack>
        <YStack flex={1} minWidth={0}>
          <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
            {label}
          </SizableText>
          {hint ? (
            <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
              {hint}
            </SizableText>
          ) : null}
        </YStack>
      </XStack>
      <Currency
        {...REFERRAL_USD_CURRENCY_PROPS}
        size="$bodyMdMedium"
        numberOfLines={1}
        alignSelf="flex-start"
        lineHeight={20}
      >
        {value}
      </Currency>
    </XStack>
  );
}

// Compact layouts read the money as one sum: the total earned leads, then
// its two parts (paid, and unpaid with the next payout date), then the
// payout address as a row, in the caution color while it is not set.
function CompactEarnings({
  earnings,
  labels,
  payoutAddress,
  isPayoutAddressSet,
  onEditAddress,
  onOpenHistory,
}: {
  earnings: IInviteEarnings;
  labels: IEarningsLabels;
  payoutAddress: string;
  isPayoutAddressSet: boolean;
  onEditAddress: () => void;
  onOpenHistory: () => void;
}) {
  return (
    <YStack>
      <XStack ai="center" jc="space-between" gap="$3">
        <SizableText size="$bodyMd" color="$textSubdued">
          {labels.cumulative}
        </SizableText>
        <CardTextAction
          testID={ReferFriendsTestIDs.inviteRewardHistory}
          label={labels.history}
          onPress={onOpenHistory}
        />
      </XStack>
      <Currency
        {...REFERRAL_USD_CURRENCY_PROPS}
        size="$heading3xl"
        numberOfLines={1}
        pt="$1"
        pb="$3"
      >
        {earnings.cumulative}
      </Currency>
      <YStack gap="$1" pb="$3">
        <EarningsPartRow
          dotColor="$iconSuccess"
          label={labels.distributed}
          value={earnings.distributed}
        />
        <EarningsPartRow
          dotColor="$iconCaution"
          label={labels.undistributed}
          value={earnings.undistributed}
          hint={
            earnings.nextDistribution
              ? `${labels.nextDistribution} ${earnings.nextDistribution}`
              : null
          }
        />
      </YStack>
      <Divider mb="$1" borderColor={INVITE_CARD_BORDER_COLOR} />
      <ListItem
        testID={ReferFriendsTestIDs.invitePayoutAddress}
        {...COMPACT_ROW_BLEED_PROPS}
        titleProps={COMPACT_ENTRY_TITLE_PROPS}
        title={labels.payoutAddress}
        drillIn
        onPress={onEditAddress}
      >
        <SizableText
          size="$bodyMd"
          color={isPayoutAddressSet ? '$textSubdued' : '$textCaution'}
          numberOfLines={1}
          flexShrink={1}
        >
          {payoutAddress}
        </SizableText>
      </ListItem>
    </YStack>
  );
}

export function InviteEarningsCard({
  summaryInfo,
  fetchSummaryInfo,
}: {
  summaryInfo: IInviteSummary;
  fetchSummaryInfo: () => unknown;
}) {
  const intl = useIntl();
  const { md } = useMedia();
  const navigateToRewardHistory = useNavigateToRewardHistory();
  const navigateToEditAddress = useNavigateToEditAddress();
  // The address cell edits the address in place instead of routing through
  // the payout history page.
  const editPayoutAddress = useCallback(() => {
    openInviteWithdrawAddressEditor({
      summaryInfo,
      navigateToEditAddress,
      fetchSummaryInfo,
      formatMessage: (descriptor) => intl.formatMessage(descriptor),
    });
  }, [fetchSummaryInfo, intl, navigateToEditAddress, summaryInfo]);
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
    history: INVITE_COPY.payoutHistory,
    payoutAddress: intl.formatMessage({
      id: ETranslations.referral_reward_received_address,
    }),
  };
  const withdrawAddress = summaryInfo.withdrawAddresses[0]?.address;
  const payoutAddress = withdrawAddress
    ? accountUtils.shortenAddress({ address: withdrawAddress })
    : intl.formatMessage({
        id: ETranslations.referral_reward_received_address_notset,
      });
  const cardStyle = useInviteHomeCardStyle();

  if (md) {
    return (
      <YStack
        testID={ReferFriendsTestIDs.inviteEarningsCard}
        px="$4"
        pt="$4"
        pb="$1"
        {...cardStyle}
      >
        <CompactEarnings
          earnings={earnings}
          labels={labels}
          payoutAddress={payoutAddress}
          isPayoutAddressSet={Boolean(withdrawAddress)}
          onEditAddress={editPayoutAddress}
          onOpenHistory={navigateToRewardHistory}
        />
      </YStack>
    );
  }

  return (
    <YStack
      testID={ReferFriendsTestIDs.inviteEarningsCard}
      flex={1}
      p="$5"
      {...cardStyle}
    >
      <DesktopEarnings
        earnings={earnings}
        labels={labels}
        payoutAddress={payoutAddress}
        onOpenHistory={navigateToRewardHistory}
        onEditAddress={editPayoutAddress}
      />
    </YStack>
  );
}
