import type { ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { InfoIcon } from '@onekeyhq/kit/src/components/InfoIcon';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useNavigateToEarnReward } from '@onekeyhq/kit/src/views/ReferFriends/pages/EarnReward/hooks/useNavigateToEarnReward';
import { useNavigateToHardwareSalesReward } from '@onekeyhq/kit/src/views/ReferFriends/pages/HardwareSalesReward/hooks/useNavigateToHardwareSalesReward';
import { useNavigateToPerpsReward } from '@onekeyhq/kit/src/views/ReferFriends/pages/PerpsReward/hooks/useNavigateToPerpsReward';
import { useNavigateToSwapReward } from '@onekeyhq/kit/src/views/ReferFriends/pages/SwapReward/hooks/useNavigateToSwapReward';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IInviteSummary } from '@onekeyhq/shared/src/referralCode/type';

import { ReferralCardEmpty } from '../../../components/ReferralCardEmpty';
import { ReferFriendsTestIDs } from '../../../testIDs';
import { INVITE_COPY } from '../inviteCopy';

import {
  type IInviteRewardRow,
  type IInviteRewardSubject,
  INVITE_REWARD_SUBJECT_ICON,
  getInviteRewardRows,
} from './getInviteRewardRows';
import { InviteRewardAmount } from './InviteRewardAmount';
import { useReferralCodeCard } from './ReferralCodeCard/hooks/useReferralCodeCard';
import { REFERRAL_USD_CURRENCY_PROPS } from './shared/getRewardSummary';
import {
  COMPACT_ENTRY_TITLE_PROPS,
  COMPACT_ROW_BLEED_PROPS,
  COMPACT_ROW_ICON_PROPS,
  PRESSABLE_SURFACE_PROPS,
  useInviteHomeCardStyle,
} from './useInviteCardStyle';

import type { IInviteValueSummaryResult } from './InviteValueLine';
import type { IInviteCardStyle } from './useInviteCardStyle';

const SUBJECT_TITLE: Record<IInviteRewardSubject, ETranslations> = {
  hardware: ETranslations.referral_referred_type_3,
  perps: ETranslations.referral_perps,
  swap: ETranslations.swap_referral_link__title,
  defi: ETranslations.referral_referred_type_2,
};

interface IRewardLabelTooltip {
  title: string;
  content: string;
}

function stopPropagation(e: { stopPropagation: () => void }) {
  e.stopPropagation();
}

function RewardLabel({ label }: { label: string }) {
  return (
    <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
      {label}
    </SizableText>
  );
}

function RewardListRow({
  row,
  title,
  pendingLabel,
  onPress,
}: {
  row: IInviteRewardRow;
  title: string;
  // Labels the pending payout (hardware only), a quiet line under the
  // available amount. Its rules and this month's sales live on the detail
  // page.
  pendingLabel: string;
  onPress: () => void;
}) {
  return (
    <ListItem
      {...COMPACT_ROW_BLEED_PROPS}
      icon={INVITE_REWARD_SUBJECT_ICON[row.subject]}
      iconProps={COMPACT_ROW_ICON_PROPS}
      titleProps={COMPACT_ENTRY_TITLE_PROPS}
      title={title}
      drillIn
      onPress={onPress}
    >
      {row.pending ? (
        <YStack ai="flex-end" gap="$0.5">
          {/* A zero, not "No reward yet", when a payout is on its way. */}
          <InviteRewardAmount summary={row.available} />
          <XStack ai="center" gap="$1">
            <SizableText size="$bodySm" color="$textSubdued">
              {pendingLabel}
            </SizableText>
            <InviteRewardAmount
              summary={row.pending}
              size="$bodySm"
              color="$textSubdued"
            />
          </XStack>
        </YStack>
      ) : (
        <InviteRewardAmount summary={row.available} emptyLabel />
      )}
    </ListItem>
  );
}

interface IDesktopRewardLabels {
  product: string;
  monthly: string;
  available: string;
  pending: string;
}

// Which optional columns the desktop table shows: monthly sales and pending
// only exist for hardware, so they drop out when no listed row has them.
interface IDesktopRewardColumns {
  monthly: boolean;
  pending: boolean;
}

// One cell of the desktop table; every row and the header share the same
// flex basis, so the columns line up.
function DesktopCell({
  children,
  first,
}: {
  children?: ReactNode;
  first?: boolean;
}) {
  return (
    <XStack
      flex={first ? 1.4 : 1}
      flexBasis={0}
      minWidth={0}
      ai="center"
      gap={first ? '$3' : '$1'}
    >
      {children}
    </XStack>
  );
}

// Desktop reads the breakdown as a table on the page itself, like the
// market lists: no frame or row lines, the column labels once at the top,
// and each figure under its label. Rows hover as rounded surfaces that bleed
// 12px past the text, so the text lines up with the section title.
const DESKTOP_ROW_BLEED_PROPS = {
  mx: '$-3',
  px: '$3',
  borderRadius: '$3',
} as const;

function DesktopRewardHeader({
  labels,
  columns,
}: {
  labels: IDesktopRewardLabels;
  columns: IDesktopRewardColumns;
}) {
  return (
    <XStack ai="center" gap="$4" {...DESKTOP_ROW_BLEED_PROPS} pb="$2">
      <DesktopCell first>
        <RewardLabel label={labels.product} />
      </DesktopCell>
      {columns.monthly ? (
        <DesktopCell>
          <RewardLabel label={labels.monthly} />
        </DesktopCell>
      ) : null}
      <DesktopCell>
        <RewardLabel label={labels.available} />
      </DesktopCell>
      {columns.pending ? (
        <DesktopCell>
          <RewardLabel label={labels.pending} />
        </DesktopCell>
      ) : null}
      {/* Chevron-wide spacer, so the header lines up with the rows. */}
      <Stack w="$5" />
    </XStack>
  );
}

// The product's icon on a round tile, the row's visual anchor like a token
// logo in the wallet lists. The folded group keeps the tile's width blank.
function ProductTile({ subject }: { subject?: IInviteRewardSubject }) {
  return (
    <Stack
      w="$10"
      h="$10"
      borderRadius="$full"
      bg={subject ? '$bgStrong' : undefined}
      ai="center"
      jc="center"
      flexShrink={0}
    >
      {subject ? (
        <Icon name={INVITE_REWARD_SUBJECT_ICON[subject]} size="$5" />
      ) : null}
    </Stack>
  );
}

// Amounts use the earnings card's basis, so the rows add up to its unpaid
// total. Pending is not payable yet, so it reads quieter than unpaid. The
// product's own rate sits under its name.
function DesktopRewardRow({
  row,
  title,
  rate,
  columns,
  noRewardLabel,
  pendingTooltip,
  onPress,
}: {
  row: IInviteRewardRow;
  title: string;
  rate?: string;
  columns: IDesktopRewardColumns;
  noRewardLabel: string;
  pendingTooltip?: IRewardLabelTooltip;
  onPress: () => void;
}) {
  const { pending } = row;
  const hasReward = row.available.hasReward;

  return (
    <XStack
      ai="center"
      gap="$4"
      {...DESKTOP_ROW_BLEED_PROPS}
      py="$3"
      {...PRESSABLE_SURFACE_PROPS}
      onPress={onPress}
    >
      <DesktopCell first>
        <ProductTile subject={row.subject} />
        <YStack flex={1} minWidth={0}>
          <SizableText size="$bodyLgMedium" numberOfLines={1}>
            {title}
          </SizableText>
          {rate ? (
            <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
              {`${INVITE_COPY.heroYouEarn} ${rate}`}
            </SizableText>
          ) : null}
        </YStack>
      </DesktopCell>
      {columns.monthly ? (
        <DesktopCell>
          {row.monthlySalesFiatValue ? (
            <Currency
              size="$bodyLgMedium"
              formatter="value"
              numberOfLines={1}
              // Sales arrive in the wallet currency; show them in USD too.
              targetCurrency={REFERRAL_USD_CURRENCY_PROPS.targetCurrency}
            >
              {row.monthlySalesFiatValue}
            </Currency>
          ) : null}
        </DesktopCell>
      ) : null}
      <DesktopCell>
        {hasReward || pending ? (
          <InviteRewardAmount summary={row.available} size="$bodyLgMedium" />
        ) : (
          <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
            {noRewardLabel}
          </SizableText>
        )}
      </DesktopCell>
      {columns.pending ? (
        <DesktopCell>
          {pending ? (
            <>
              <InviteRewardAmount
                summary={pending}
                size="$bodyLgMedium"
                color="$textSubdued"
              />
              {/* The confirmation window is the product's own rule (only
                  hardware has a pending payout), so it sits on the value,
                  not on the column label; its tap stays off the row. */}
              {pendingTooltip ? (
                <Stack onPress={stopPropagation}>
                  <InfoIcon size="$4" tooltip={pendingTooltip} />
                </Stack>
              ) : null}
            </>
          ) : null}
        </DesktopCell>
      ) : null}
      <Icon name="ChevronRightSmallOutline" size="$5" color="$iconSubdued" />
    </XStack>
  );
}

// Two or more products without rewards fold into one line that expands in
// place; a blank tile keeps the names aligned with the rows above.
function DesktopFoldedRow({
  title,
  noRewardLabel,
  isOpen,
  onPress,
}: {
  title: string;
  noRewardLabel: string;
  isOpen: boolean;
  onPress: () => void;
}) {
  return (
    <XStack
      ai="center"
      gap="$3"
      {...DESKTOP_ROW_BLEED_PROPS}
      py="$3"
      {...PRESSABLE_SURFACE_PROPS}
      onPress={onPress}
    >
      <ProductTile />
      <SizableText flex={1} size="$bodyLgMedium" numberOfLines={1}>
        {title}
      </SizableText>
      <SizableText size="$bodyMd" color="$textSubdued">
        {noRewardLabel}
      </SizableText>
      <Icon
        name={isOpen ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'}
        size="$5"
        color="$iconSubdued"
      />
    </XStack>
  );
}

// Before the first reward every product page is empty too, so the section
// shows one quiet in-card empty state: what will appear here, plus the one
// action that changes it. Native already has the share footer, so only the
// pointer layout gets the button.
function RewardsEmpty({
  cardStyle,
  onCopyLink,
}: {
  cardStyle: IInviteCardStyle;
  onCopyLink?: () => void;
}) {
  return (
    <ReferralCardEmpty
      {...cardStyle}
      description={INVITE_COPY.rewardsEmptyHint}
      buttonProps={
        onCopyLink
          ? {
              testID: ReferFriendsTestIDs.inviteRewardsEmptyCopyBtn,
              variant: 'secondary',
              size: 'small',
              mt: '$4',
              children: INVITE_COPY.copyLink,
              onPress: onCopyLink,
            }
          : undefined
      }
    />
  );
}

function useOpenInviteRewardSubject(earnTitle: string) {
  const navigateToHardwareSalesReward = useNavigateToHardwareSalesReward();
  const navigateToPerpsReward = useNavigateToPerpsReward();
  const navigateToSwapReward = useNavigateToSwapReward();
  const navigateToEarnReward = useNavigateToEarnReward();

  return useCallback(
    (subject: IInviteRewardSubject) => {
      if (subject === 'hardware') {
        navigateToHardwareSalesReward();
        return;
      }
      if (subject === 'perps') {
        void navigateToPerpsReward();
        return;
      }
      if (subject === 'swap') {
        navigateToSwapReward();
        return;
      }
      navigateToEarnReward(earnTitle);
    },
    [
      earnTitle,
      navigateToEarnReward,
      navigateToHardwareSalesReward,
      navigateToPerpsReward,
      navigateToSwapReward,
    ],
  );
}

// Backend rate subjects behind each reward row; DeFi rates may arrive under
// either name.
const RATE_SUBJECTS: Record<IInviteRewardSubject, string[]> = {
  hardware: ['HardwareSales'],
  perps: ['Perp'],
  swap: ['Swap'],
  defi: ['Earn', 'Onchain'],
};

export function InviteRewardRows({
  summaryInfo,
  valueSummary,
}: {
  summaryInfo: IInviteSummary;
  // Desktop rows show each product's own rate under its name.
  valueSummary?: IInviteValueSummaryResult;
}) {
  const intl = useIntl();
  const { md } = useMedia();
  const cardStyle = useInviteHomeCardStyle();
  const [isFoldedOpen, setIsFoldedOpen] = useState(false);
  const rows = useMemo(() => getInviteRewardRows(summaryInfo), [summaryInfo]);
  const { copyLink } = useReferralCodeCard({
    inviteUrl: summaryInfo.inviteUrl,
    inviteCode: summaryInfo.inviteCode,
  });
  const openSubject = useOpenInviteRewardSubject(
    summaryInfo.Onchain.title || '',
  );
  const rateRows = valueSummary?.summary?.rows;
  const rateFor = useCallback(
    (subject: IInviteRewardSubject) =>
      rateRows?.find((rateRow) =>
        RATE_SUBJECTS[subject].includes(rateRow.subject),
      )?.you,
    [rateRows],
  );
  const titleFor = useCallback(
    (subject: IInviteRewardSubject) =>
      intl.formatMessage({ id: SUBJECT_TITLE[subject] }),
    [intl],
  );
  const monthlyLabel = intl.formatMessage({
    id: ETranslations.referral_hw_sales_title,
  });
  const pendingLabel = intl.formatMessage({
    id: ETranslations.referral_sales_reward_pending,
  });
  const availableLabel = intl.formatMessage({
    id: ETranslations.referral_undistributed,
  });
  const hardwarePendingTooltip: IRewardLabelTooltip = {
    title: intl.formatMessage({
      id: ETranslations.referral_hw_pending_pop_title,
    }),
    content: intl.formatMessage({
      id: ETranslations.referral_hw_pending_pop,
    }),
  };
  const noRewardLabel = intl.formatMessage({
    id: ETranslations.referral_no_reward,
  });
  const foldedTitle = rows.foldedRows
    .map((row) => titleFor(row.subject))
    .join(' · ');

  if (!md) {
    const hasAnyData = rows.visibleRows.length > 0;
    const desktopLabels: IDesktopRewardLabels = {
      product: INVITE_COPY.product,
      monthly: monthlyLabel,
      available: availableLabel,
      pending: pendingLabel,
    };
    const desktopColumns: IDesktopRewardColumns = {
      monthly: rows.visibleRows.some((row) => row.monthlySalesFiatValue),
      pending: rows.visibleRows.some((row) => row.pending),
    };
    return (
      // A wider gap splits the overview cards from the per-product
      // breakdown; the section title matches the app's other section titles.
      <YStack px="$pagePadding" pt="$10" gap="$3">
        <SizableText size="$headingLg">
          {INVITE_COPY.rewardsByProduct}
        </SizableText>
        {hasAnyData ? (
          <YStack>
            <DesktopRewardHeader
              labels={desktopLabels}
              columns={desktopColumns}
            />
            {[
              ...rows.visibleRows,
              ...(rows.foldedRows.length === 1 || isFoldedOpen
                ? rows.foldedRows
                : []),
            ].map((row) => (
              <DesktopRewardRow
                key={row.subject}
                row={row}
                title={titleFor(row.subject)}
                rate={rateFor(row.subject)}
                columns={desktopColumns}
                noRewardLabel={noRewardLabel}
                pendingTooltip={hardwarePendingTooltip}
                onPress={() => {
                  openSubject(row.subject);
                }}
              />
            ))}
            {rows.foldedRows.length > 1 && !isFoldedOpen ? (
              <DesktopFoldedRow
                title={foldedTitle}
                noRewardLabel={noRewardLabel}
                isOpen={isFoldedOpen}
                onPress={() => {
                  setIsFoldedOpen(true);
                }}
              />
            ) : null}
          </YStack>
        ) : (
          <RewardsEmpty cardStyle={cardStyle} onCopyLink={copyLink} />
        )}
      </YStack>
    );
  }

  // Compact layouts: a quiet caption, like a grouped list header, right
  // under the earnings card it breaks down; the page sets the spacing.
  const compactTitle = (
    <SizableText size="$bodyMdMedium" color="$textSubdued">
      {INVITE_COPY.rewardsByProduct}
    </SizableText>
  );

  if (rows.visibleRows.length === 0) {
    return (
      <YStack gap="$2">
        {compactTitle}
        <RewardsEmpty cardStyle={cardStyle} />
      </YStack>
    );
  }

  const renderFoldedRow = (row: IInviteRewardRow) => (
    <RewardListRow
      key={row.subject}
      row={row}
      title={titleFor(row.subject)}
      pendingLabel={pendingLabel}
      onPress={() => {
        openSubject(row.subject);
      }}
    />
  );

  return (
    <YStack gap="$2">
      {compactTitle}
      {/* In a card like the blocks above, so the row text lines up with
          theirs. */}
      <YStack px="$4" py="$1" {...cardStyle}>
        {rows.visibleRows.map((row) => (
          <RewardListRow
            key={row.subject}
            row={row}
            title={titleFor(row.subject)}
            pendingLabel={pendingLabel}
            onPress={() => {
              openSubject(row.subject);
            }}
          />
        ))}
        {/* Like desktop: one product without rewards is listed directly; two
          or more fold into one row that expands in place. */}
        {rows.foldedRows.length > 1 ? (
          <ListItem
            {...COMPACT_ROW_BLEED_PROPS}
            // Icon-wide gap so the names line up with the product rows.
            renderIcon={<Stack w="$5" flexShrink={0} />}
            titleProps={COMPACT_ENTRY_TITLE_PROPS}
            title={foldedTitle}
            onPress={() => {
              setIsFoldedOpen((open) => !open);
            }}
          >
            <XStack ai="center" gap="$1" flexShrink={0}>
              <SizableText size="$bodyMd" color="$textSubdued">
                {noRewardLabel}
              </SizableText>
              <Icon
                name={
                  isFoldedOpen
                    ? 'ChevronTopSmallOutline'
                    : 'ChevronDownSmallOutline'
                }
                // Same size and edge as the list drill-in chevrons.
                color="$iconSubdued"
                mx="$-1.5"
              />
            </XStack>
          </ListItem>
        ) : null}
        {rows.foldedRows.length === 1 || isFoldedOpen
          ? rows.foldedRows.map(renderFoldedRow)
          : null}
      </YStack>
    </YStack>
  );
}
