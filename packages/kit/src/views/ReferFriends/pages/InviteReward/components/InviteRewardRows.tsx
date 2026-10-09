import type { ReactNode } from 'react';
import { Fragment, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Divider,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { IKeyOfIcons, ISizableTextProps } from '@onekeyhq/components';
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
  INVITE_CARD_BORDER_COLOR,
  PRESSABLE_SURFACE_PROPS,
  useInviteHomeCardStyle,
} from './useInviteCardStyle';

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

function RewardLabel({
  label,
  tooltip,
  size = '$bodySm',
}: {
  label: string;
  tooltip?: IRewardLabelTooltip;
  size?: ISizableTextProps['size'];
}) {
  return (
    <XStack ai="center" gap="$1">
      <SizableText size={size} color="$textSubdued">
        {label}
      </SizableText>
      {tooltip ? (
        // Keep the tooltip tap from opening the row's detail page.
        <Stack onPress={stopPropagation}>
          <InfoIcon size="$4" tooltip={tooltip} />
        </Stack>
      ) : null}
    </XStack>
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
  pendingTooltip: IRewardLabelTooltip;
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

// Desktop reads the breakdown as a table: the column labels once at the top,
// then one line per product, so each figure sits under its label.
function DesktopRewardHeader({
  labels,
  columns,
}: {
  labels: IDesktopRewardLabels;
  columns: IDesktopRewardColumns;
}) {
  return (
    <XStack ai="center" gap="$4" px="$5" pt="$4" pb="$3">
      <DesktopCell first>
        <RewardLabel label={labels.product} size="$bodyMd" />
      </DesktopCell>
      {columns.monthly ? (
        <DesktopCell>
          <RewardLabel label={labels.monthly} size="$bodyMd" />
        </DesktopCell>
      ) : null}
      <DesktopCell>
        <RewardLabel label={labels.available} size="$bodyMd" />
      </DesktopCell>
      {columns.pending ? (
        <DesktopCell>
          <RewardLabel
            label={labels.pending}
            tooltip={labels.pendingTooltip}
            size="$bodyMd"
          />
        </DesktopCell>
      ) : null}
      {/* Chevron-wide spacer, so the header lines up with the rows. */}
      <Stack w="$5" />
    </XStack>
  );
}

// Amounts use the earnings card's basis, so the rows add up to its unpaid
// total. Pending is not payable yet, so it reads quieter than unpaid.
function DesktopRewardRow({
  row,
  title,
  columns,
  noRewardLabel,
  onPress,
}: {
  row: IInviteRewardRow;
  title: string;
  columns: IDesktopRewardColumns;
  noRewardLabel: string;
  onPress: () => void;
}) {
  const { pending } = row;
  const hasReward = row.available.hasReward;

  return (
    <XStack
      ai="center"
      gap="$4"
      px="$5"
      py="$3.5"
      {...PRESSABLE_SURFACE_PROPS}
      onPress={onPress}
    >
      <DesktopCell first>
        <Icon
          name={INVITE_REWARD_SUBJECT_ICON[row.subject]}
          size="$6"
          color="$iconSubdued"
          flexShrink={0}
        />
        <SizableText size="$bodyLgMedium" numberOfLines={1}>
          {title}
        </SizableText>
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
            <InviteRewardAmount
              summary={pending}
              size="$bodyLgMedium"
              color="$textSubdued"
            />
          ) : null}
        </DesktopCell>
      ) : null}
      <Icon name="ChevronRightSmallOutline" size="$5" color="$iconSubdued" />
    </XStack>
  );
}

// Rows inside the table card are separated by dividers inset to the text, so
// they read as lines of one table rather than stacked boxes.
function DesktopRowDivider() {
  return <Divider mx="$5" borderColor={INVITE_CARD_BORDER_COLOR} />;
}

// Compact desktop line for products without rewards: a single product
// (icon, opens its page) or the folded group of two or more (icon-wide gap so
// names line up, toggles in place).
function DesktopCompactRow({
  icon,
  title,
  noRewardLabel,
  trailingIcon,
  onPress,
}: {
  icon?: IInviteRewardRow['subject'];
  title: string;
  noRewardLabel: string;
  trailingIcon: IKeyOfIcons;
  onPress: () => void;
}) {
  return (
    <XStack
      ai="center"
      gap="$3"
      px="$5"
      py="$3.5"
      {...PRESSABLE_SURFACE_PROPS}
      onPress={onPress}
    >
      {icon ? (
        <Icon
          name={INVITE_REWARD_SUBJECT_ICON[icon]}
          size="$6"
          color="$iconSubdued"
          flexShrink={0}
        />
      ) : (
        <Stack w="$6" flexShrink={0} />
      )}
      <SizableText flex={1} size="$bodyLgMedium" numberOfLines={1}>
        {title}
      </SizableText>
      <SizableText size="$bodyMd" color="$textSubdued">
        {noRewardLabel}
      </SizableText>
      <Icon name={trailingIcon} size="$5" color="$iconSubdued" />
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

export function InviteRewardRows({
  summaryInfo,
}: {
  summaryInfo: IInviteSummary;
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
      pendingTooltip: hardwarePendingTooltip,
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
          <YStack overflow="hidden" pb="$1" {...cardStyle}>
            <DesktopRewardHeader
              labels={desktopLabels}
              columns={desktopColumns}
            />
            {rows.visibleRows.map((row) => (
              <Fragment key={row.subject}>
                <DesktopRowDivider />
                <DesktopRewardRow
                  row={row}
                  title={titleFor(row.subject)}
                  columns={desktopColumns}
                  noRewardLabel={noRewardLabel}
                  onPress={() => {
                    openSubject(row.subject);
                  }}
                />
              </Fragment>
            ))}
            {rows.foldedRows.length > 1 ? (
              <>
                <DesktopRowDivider />
                <DesktopCompactRow
                  title={foldedTitle}
                  noRewardLabel={noRewardLabel}
                  trailingIcon={
                    isFoldedOpen
                      ? 'ChevronTopSmallOutline'
                      : 'ChevronDownSmallOutline'
                  }
                  onPress={() => {
                    setIsFoldedOpen((open) => !open);
                  }}
                />
              </>
            ) : null}
            {rows.foldedRows.length === 1 || isFoldedOpen
              ? rows.foldedRows.map((row) => (
                  <Fragment key={row.subject}>
                    <DesktopRowDivider />
                    <DesktopCompactRow
                      icon={row.subject}
                      title={titleFor(row.subject)}
                      noRewardLabel={noRewardLabel}
                      trailingIcon="ChevronRightSmallOutline"
                      onPress={() => {
                        openSubject(row.subject);
                      }}
                    />
                  </Fragment>
                ))
              : null}
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
