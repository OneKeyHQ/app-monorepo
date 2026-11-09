import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Divider,
  Icon,
  IconButton,
  Illustration,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { useNextDistributionLabel } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useNextDistributionLabel';
import { useNavigateToEditAddress } from '@onekeyhq/kit/src/views/ReferFriends/pages/EditAddress/hooks/useNavigateToEditAddress';
import { useNavigateToRewardHistory } from '@onekeyhq/kit/src/views/ReferFriends/pages/RewardDistributionHistory/hooks/useNavigateToRewardHistory';
import { openInviteWithdrawAddressEditor } from '@onekeyhq/kit/src/views/ReferFriends/pages/RewardDistributionHistory/openInviteWithdrawAddressEditor';
import { shortenPayoutAddress } from '@onekeyhq/kit/src/views/ReferFriends/utils/shortenPayoutAddress';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IInviteSummary } from '@onekeyhq/shared/src/referralCode/type';

import { CompactFieldRow } from '../../../components/CompactFieldRow';
import { ReferFriendsTestIDs } from '../../../testIDs';

import { CardTextAction } from './CardTextAction';
import { getInviteEarningsState } from './getInviteEarningsState';
import { InviteStatCell as StatCell } from './InviteStatCell';
import { PartDot } from './PartDot';
import { REFERRAL_USD_SOURCE_PROPS } from './shared/getRewardSummary';
import {
  COMPACT_ENTRY_TITLE_PROPS,
  COMPACT_ROW_BLEED_PROPS,
  INVITE_CARD_BORDER_COLOR,
  useInviteHomeCardStyle,
} from './useInviteCardStyle';

type IInviteEarnings = ReturnType<typeof getInviteEarningsState>;

interface IEarningsLabels {
  undistributed: string;
  distributed: string;
  cumulative: string;
  history: string;
  payoutAddress: string;
  // "Next payout {date}", or null before a payout is scheduled.
  nextPayout: string | null;
}

// Desktop's lead figure, in the wallet currency like every referral amount.
function LeadAmount({ amount }: { amount: string }) {
  return (
    <Currency
      {...REFERRAL_USD_SOURCE_PROPS}
      size="$heading4xl"
      numberOfLines={1}
      flexShrink={1}
    >
      {amount}
    </Currency>
  );
}

const HIDDEN_ADDRESS_MASK = '**********';

interface IPayoutAddressVisibility {
  isVisible: boolean;
  onToggle: () => void;
}

// The payout address with the chain it is paid on, so people can tell where
// the rewards land; only shown once an address is set. A set address can be
// masked with the eye button, whose press stays off the cell. The mask covers
// the address instead of replacing it, so the buttons keep their place.
function PayoutAddressValue({
  address,
  networkId,
  size,
  color,
  visibility,
}: {
  address: string;
  networkId?: string;
  size: '$bodyLgMedium' | '$bodyMd';
  color?: '$textSubdued' | '$textCaution';
  visibility?: IPayoutAddressVisibility;
}) {
  const isHidden = visibility ? !visibility.isVisible : false;
  return (
    <XStack ai="center" gap="$1.5" flexShrink={1} minWidth={0}>
      {networkId ? (
        <NetworkAvatar
          networkId={networkId}
          // A chain mark, a step below the address text.
          size={size === '$bodyMd' ? '$3.5' : '$4'}
        />
      ) : null}
      <YStack flexShrink={1} minWidth={0}>
        <SizableText
          size={size}
          color={color}
          numberOfLines={1}
          opacity={isHidden ? 0 : 1}
          // Hidden means hidden from screen readers and selection too.
          aria-hidden={isHidden}
          userSelect={isHidden ? 'none' : undefined}
        >
          {address}
        </SizableText>
        {isHidden ? (
          <SizableText
            size={size}
            color={color}
            numberOfLines={1}
            position="absolute"
            top={0}
            left={0}
            right={0}
          >
            {HIDDEN_ADDRESS_MASK}
          </SizableText>
        ) : null}
      </YStack>
      {visibility ? (
        <IconButton
          testID={ReferFriendsTestIDs.invitePayoutAddressVisibility}
          icon={visibility.isVisible ? 'EyeOffOutline' : 'EyeOutline'}
          variant="tertiary"
          size="small"
          onPress={visibility.onToggle}
        />
      ) : null}
      {/* The cell edits the address; the pencil sits right after it, clear
          of the eye button's touch area. */}
      <Icon
        name="PencilOutline"
        size="$5"
        color="$iconSubdued"
        flexShrink={0}
        ml="$2"
      />
    </XStack>
  );
}

// Ties each part of the earnings card's total to it, like a chart legend.

// The next payout date is the card's one time-bound fact, so desktop lifts
// it into the lead group as a brand-green pill instead of a footnote.
function NextPayoutPill({ label }: { label: string }) {
  return (
    <XStack
      ai="center"
      gap="$1.5"
      px="$2.5"
      py="$1"
      borderRadius="$full"
      bg="$bgSuccess"
    >
      <Icon name="CalendarOutline" size="$4" color="$iconSuccess" />
      <SizableText size="$bodyMdMedium" color="$textSuccess" numberOfLines={1}>
        {label}
      </SizableText>
    </XStack>
  );
}

// Desktop reads the money the way compact layouts do: the total earned
// leads with the next payout date, and its two parts follow with the same
// legend dots (paid, unpaid), then the payout address.
function DesktopEarnings({
  earnings,
  labels,
  payoutAddress,
  payoutNetworkId,
  addressVisibility,
  onOpenHistory,
  onEditAddress,
}: {
  earnings: IInviteEarnings;
  labels: IEarningsLabels;
  payoutAddress: string;
  payoutNetworkId?: string;
  addressVisibility?: IPayoutAddressVisibility;
  onOpenHistory: () => void;
  onEditAddress: () => void;
}) {
  return (
    <YStack flex={1} gap="$4">
      {/* The label sits right on its amount; the card's spare height (it
          stretches to the invite card) becomes the gap above the parts,
          which rest on a hairline. */}
      <YStack gap="$1">
        <XStack ai="center" jc="space-between" gap="$3">
          <SizableText size="$bodyLgMedium" color="$textSubdued">
            {labels.cumulative}
          </SizableText>
          <CardTextAction
            testID={ReferFriendsTestIDs.inviteRewardHistory}
            label={labels.history}
            onPress={onOpenHistory}
          />
        </XStack>
        {/* Top-aligned, so the taller art hangs beside the amount instead
            of pushing it away from its label. */}
        <XStack ai="flex-start" gap="$4">
          <YStack flex={1} minWidth={0} ai="flex-start" gap="$2">
            <LeadAmount amount={earnings.cumulative} />
            {labels.nextPayout ? (
              <NextPayoutPill label={labels.nextPayout} />
            ) : null}
          </YStack>
          {/* A touch of the brand's line art in the room the amount leaves;
              it has a dark variant of its own. */}
          <Illustration name="BlockCoins" size={80} flexShrink={0} />
        </XStack>
      </YStack>
      <Divider mt="auto" borderColor={INVITE_CARD_BORDER_COLOR} />
      {/* The figures share one size; the address is text, so it keeps the
          medium weight instead of the figures' semibold. */}
      <XStack ai="flex-start" gap="$6">
        <StatCell
          leading={<PartDot color="$iconSuccess" />}
          label={labels.distributed}
          minWidth="$16"
        >
          <Currency
            {...REFERRAL_USD_SOURCE_PROPS}
            size="$headingMd"
            numberOfLines={1}
          >
            {earnings.distributed}
          </Currency>
        </StatCell>
        <StatCell
          leading={<PartDot color="$iconCaution" />}
          label={labels.undistributed}
          minWidth="$16"
        >
          <Currency
            {...REFERRAL_USD_SOURCE_PROPS}
            size="$headingMd"
            numberOfLines={1}
          >
            {earnings.undistributed}
          </Currency>
        </StatCell>
        <StatCell
          testID={ReferFriendsTestIDs.invitePayoutAddress}
          // The shortened address keeps its tail. The paid and unpaid
          // amounts are the cells that give up width.
          shrink={false}
          label={labels.payoutAddress}
          onPress={onEditAddress}
        >
          <PayoutAddressValue
            address={payoutAddress}
            networkId={payoutNetworkId}
            size="$bodyLgMedium"
            visibility={addressVisibility}
          />
        </StatCell>
      </XStack>
    </YStack>
  );
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
  addressVisibility,
  onEditAddress,
  onOpenHistory,
}: {
  earnings: IInviteEarnings;
  labels: IEarningsLabels;
  payoutAddress: string;
  payoutNetworkId?: string;
  // Only a set address can be masked.
  addressVisibility?: IPayoutAddressVisibility;
  onEditAddress: () => void;
  onOpenHistory: () => void;
}) {
  return (
    <YStack>
      {/* Payout history sits on the total it explains, as the app's usual
          history clock, level with the label. */}
      <XStack ai="flex-start" gap="$3" pb="$3">
        <YStack flex={1} minWidth={0}>
          <SizableText size="$bodyMd" color="$textSubdued">
            {labels.cumulative}
          </SizableText>
          <Currency
            {...REFERRAL_USD_SOURCE_PROPS}
            size="$heading3xl"
            numberOfLines={1}
            pt="$1"
          >
            {earnings.cumulative}
          </Currency>
        </YStack>
        <IconButton
          testID={ReferFriendsTestIDs.inviteRewardHistory}
          variant="tertiary"
          size="small"
          icon="ClockTimeHistoryOutline"
          title={labels.history}
          onPress={onOpenHistory}
        />
      </XStack>
      <YStack pb="$3">
        <CompactFieldRow
          leading={<PartDot color="$iconSuccess" />}
          label={labels.distributed}
        >
          <Currency
            {...REFERRAL_USD_SOURCE_PROPS}
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
          hint={labels.nextPayout}
        >
          <Currency
            {...REFERRAL_USD_SOURCE_PROPS}
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
        onPress={onEditAddress}
      >
        <PayoutAddressValue
          address={payoutAddress}
          networkId={payoutNetworkId}
          size="$bodyMd"
          color={addressVisibility ? '$textSubdued' : '$textCaution'}
          visibility={addressVisibility}
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
    () => getInviteEarningsState(summaryInfo.cumulativeRewards),
    [summaryInfo.cumulativeRewards],
  );
  const labels: IEarningsLabels = {
    undistributed: intl.formatMessage({
      id: ETranslations.referral_undistributed,
    }),
    distributed: intl.formatMessage({ id: ETranslations.referral_distributed }),
    cumulative: intl.formatMessage({
      id: ETranslations.referral_cumulative_rewards,
    }),
    history: intl.formatMessage({
      id: ETranslations.referral_payout_history__title,
    }),
    payoutAddress: intl.formatMessage({
      id: ETranslations.referral_reward_received_address,
    }),
    nextPayout: nextDistribution
      ? intl.formatMessage(
          { id: ETranslations.referral_next_payout__desc },
          { date: nextDistribution },
        )
      : null,
  };
  const payoutTarget = summaryInfo.withdrawAddresses[0];
  const withdrawAddress = payoutTarget?.address;
  const payoutNetworkId = withdrawAddress ? payoutTarget?.networkId : undefined;
  const payoutAddress = withdrawAddress
    ? shortenPayoutAddress(withdrawAddress)
    : intl.formatMessage({
        id: ETranslations.referral_reward_received_address_notset,
      });
  const [isAddressVisible, setIsAddressVisible] = useState(true);
  const toggleAddressVisibility = useCallback(() => {
    const nextVisible = !isAddressVisible;
    setIsAddressVisible(nextVisible);
    defaultLogger.referral.page.toggleReceivingAddressVisibility(nextVisible);
  }, [isAddressVisible]);
  const addressVisibility: IPayoutAddressVisibility | undefined =
    withdrawAddress
      ? { isVisible: isAddressVisible, onToggle: toggleAddressVisibility }
      : undefined;
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
          addressVisibility={addressVisibility}
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
        addressVisibility={addressVisibility}
        onOpenHistory={navigateToRewardHistory}
        onEditAddress={editPayoutAddress}
      />
    </YStack>
  );
}
