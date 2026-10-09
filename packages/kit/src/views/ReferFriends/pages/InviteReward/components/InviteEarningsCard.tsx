import { useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  Divider,
  Icon,
  Illustration,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { ColorTokens } from '@onekeyhq/components/src/shared/tamagui';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { useNavigateToEditAddress } from '@onekeyhq/kit/src/views/ReferFriends/pages/EditAddress/hooks/useNavigateToEditAddress';
import { useNavigateToRewardHistory } from '@onekeyhq/kit/src/views/ReferFriends/pages/RewardDistributionHistory/hooks/useNavigateToRewardHistory';
import { openInviteWithdrawAddressEditor } from '@onekeyhq/kit/src/views/ReferFriends/pages/RewardDistributionHistory/openInviteWithdrawAddressEditor';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IInviteSummary } from '@onekeyhq/shared/src/referralCode/type';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { CompactFieldRow } from '../../../components/CompactFieldRow';
import { ReferFriendsTestIDs } from '../../../testIDs';
import { INVITE_COPY } from '../inviteCopy';

import { CardTextAction } from './CardTextAction';
import { getInviteEarningsState } from './getInviteEarningsState';
import { REFERRAL_USD_CURRENCY_PROPS } from './shared/getRewardSummary';
import {
  COMPACT_ENTRY_TITLE_PROPS,
  COMPACT_ROW_BLEED_PROPS,
  INVITE_CARD_BORDER_COLOR,
  POINTER_ROW_BLEED_PROPS,
  PRESSABLE_SURFACE_PROPS,
  useInviteHomeCardStyle,
} from './useInviteCardStyle';
import { useNextDistributionLabel } from './useNextDistributionLabel';

type IInviteEarnings = ReturnType<typeof getInviteEarningsState>;

interface IEarningsLabels {
  undistributed: string;
  distributed: string;
  cumulative: string;
  nextDistribution: string;
  history: string;
  payoutAddress: string;
}

// Desktop's lead figure: the unpaid amount with its fixed "USD" unit (it
// stays in USD whatever the wallet currency is), and the next payout date.
function UnpaidAmount({
  amount,
  nextPayout,
  nextPayoutLabel,
}: {
  amount: string;
  nextPayout: string | null;
  nextPayoutLabel: string;
}) {
  return (
    <YStack gap="$1">
      <XStack ai="baseline" gap="$1.5">
        <Currency
          {...REFERRAL_USD_CURRENCY_PROPS}
          size="$heading4xl"
          numberOfLines={1}
          flexShrink={1}
        >
          {amount}
        </Currency>
        <SizableText size="$bodyLg" color="$textSubdued">
          USD
        </SizableText>
      </XStack>
      {nextPayout ? (
        <SizableText size="$bodyMd" color="$textSubdued">
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
      {...(onPress
        ? { ...PRESSABLE_SURFACE_PROPS, ...POINTER_ROW_BLEED_PROPS }
        : null)}
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

// The payout address with the chain it is paid on, so people can tell where
// the rewards land; only shown once an address is set.
function PayoutAddressValue({
  address,
  networkId,
  size,
  color,
}: {
  address: string;
  networkId?: string;
  size: '$bodyLgMedium' | '$bodyMd';
  color?: '$textSubdued' | '$textCaution';
}) {
  return (
    <XStack ai="center" gap="$1.5" flexShrink={1} minWidth={0}>
      {networkId ? (
        <NetworkAvatar
          networkId={networkId}
          // A chain mark, a step below the address text.
          size={size === '$bodyMd' ? '$3.5' : '$4'}
        />
      ) : null}
      <SizableText size={size} color={color} numberOfLines={1} flexShrink={1}>
        {address}
      </SizableText>
    </XStack>
  );
}

// Desktop leads with the unpaid amount, then the totals and payout address.
function DesktopEarnings({
  earnings,
  labels,
  payoutAddress,
  payoutNetworkId,
  onOpenHistory,
  onEditAddress,
}: {
  earnings: IInviteEarnings;
  labels: IEarningsLabels;
  payoutAddress: string;
  payoutNetworkId?: string;
  onOpenHistory: () => void;
  onEditAddress: () => void;
}) {
  return (
    <YStack flex={1} gap="$4">
      {/* Grouped by proximity rather than lines: the label sits right on its
          amount, and the card's spare height (it stretches to the invite
          card) becomes the gap above the stats. */}
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
        <XStack ai="center" gap="$4">
          <YStack flex={1} minWidth={0}>
            <UnpaidAmount
              amount={earnings.undistributed}
              nextPayout={earnings.nextDistribution}
              nextPayoutLabel={labels.nextDistribution}
            />
          </YStack>
          {/* A touch of the brand's line art in the room the amount leaves;
              it has a dark variant of its own. */}
          <Illustration name="BlockCoins" size={88} flexShrink={0} />
        </XStack>
      </YStack>
      {/* The three facts share one size; the address is text, so it keeps
          the medium weight instead of the figures' semibold. */}
      <XStack mt="auto" ai="center" gap="$6">
        <StatCell label={labels.cumulative}>
          <Currency
            {...REFERRAL_USD_CURRENCY_PROPS}
            size="$headingMd"
            numberOfLines={1}
          >
            {earnings.cumulative}
          </Currency>
        </StatCell>
        <StatCell label={labels.distributed}>
          <Currency
            {...REFERRAL_USD_CURRENCY_PROPS}
            size="$headingMd"
            numberOfLines={1}
          >
            {earnings.distributed}
          </Currency>
        </StatCell>
        <StatCell
          testID={ReferFriendsTestIDs.invitePayoutAddress}
          label={labels.payoutAddress}
          onPress={onEditAddress}
        >
          <PayoutAddressValue
            address={payoutAddress}
            networkId={payoutNetworkId}
            size="$bodyLgMedium"
          />
        </StatCell>
      </XStack>
    </YStack>
  );
}

// Ties each part of the compact card's total to it, like a chart legend.
function PartDot({ color }: { color: ColorTokens }) {
  return <YStack w="$2" h="$2" borderRadius="$full" bg={color} />;
}

// Compact layouts read the money as one sum: the total earned leads, then
// its two parts (paid, and unpaid with its payout date under the amount
// it applies to), then the payout address as a row, in the caution color
// while it is not set.
function CompactEarnings({
  earnings,
  labels,
  payoutAddress,
  payoutNetworkId,
  isPayoutAddressSet,
  onEditAddress,
  onOpenHistory,
}: {
  earnings: IInviteEarnings;
  labels: IEarningsLabels;
  payoutAddress: string;
  payoutNetworkId?: string;
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
      <YStack pb="$3">
        <CompactFieldRow
          leading={<PartDot color="$iconSuccess" />}
          label={labels.distributed}
        >
          <Currency
            {...REFERRAL_USD_CURRENCY_PROPS}
            size="$bodyMdMedium"
            numberOfLines={1}
          >
            {earnings.distributed}
          </Currency>
        </CompactFieldRow>
        {/* The payout date sits under the amount it applies to. */}
        <CompactFieldRow
          leading={<PartDot color="$iconCaution" />}
          label={labels.undistributed}
          hint={
            earnings.nextDistribution
              ? `${labels.nextDistribution} ${earnings.nextDistribution}`
              : null
          }
        >
          <Currency
            {...REFERRAL_USD_CURRENCY_PROPS}
            size="$bodyMdMedium"
            numberOfLines={1}
          >
            {earnings.undistributed}
          </Currency>
        </CompactFieldRow>
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
        <PayoutAddressValue
          address={payoutAddress}
          networkId={payoutNetworkId}
          size="$bodyMd"
          color={isPayoutAddressSet ? '$textSubdued' : '$textCaution'}
        />
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
  const payoutTarget = summaryInfo.withdrawAddresses[0];
  const withdrawAddress = payoutTarget?.address;
  const payoutNetworkId = withdrawAddress ? payoutTarget?.networkId : undefined;
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
          payoutNetworkId={payoutNetworkId}
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
        payoutNetworkId={payoutNetworkId}
        onOpenHistory={navigateToRewardHistory}
        onEditAddress={editPayoutAddress}
      />
    </YStack>
  );
}
