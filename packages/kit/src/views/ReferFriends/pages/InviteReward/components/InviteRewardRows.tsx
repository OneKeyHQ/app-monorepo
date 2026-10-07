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
import type { IKeyOfIcons } from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { InfoIcon } from '@onekeyhq/kit/src/components/InfoIcon';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useNavigateToEarnReward } from '@onekeyhq/kit/src/views/ReferFriends/pages/EarnReward/hooks/useNavigateToEarnReward';
import { useNavigateToHardwareSalesReward } from '@onekeyhq/kit/src/views/ReferFriends/pages/HardwareSalesReward/hooks/useNavigateToHardwareSalesReward';
import { useNavigateToPerpsReward } from '@onekeyhq/kit/src/views/ReferFriends/pages/PerpsReward/hooks/useNavigateToPerpsReward';
import { useNavigateToSwapReward } from '@onekeyhq/kit/src/views/ReferFriends/pages/SwapReward/hooks/useNavigateToSwapReward';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IInviteSummary } from '@onekeyhq/shared/src/referralCode/type';

import { INVITE_COPY } from '../inviteCopy';

import {
  type IInviteRewardRow,
  type IInviteRewardSubject,
  getInviteRewardRows,
} from './getInviteRewardRows';
import { InviteRewardAmount } from './InviteRewardAmount';
import { useNextDistributionLabel } from './useNextDistributionLabel';

const SUBJECT_ICON: Record<IInviteRewardSubject, IKeyOfIcons> = {
  hardware: 'OnekeyLiteOutline',
  perps: 'TradeOutline',
  swap: 'SwitchHorOutline',
  defi: 'CoinsOutline',
};

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
}: {
  label: string;
  tooltip?: IRewardLabelTooltip;
}) {
  return (
    <XStack ai="center" gap="$1">
      <SizableText size="$bodySm" color="$textSubdued">
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

function HardwareSubtitle({
  row,
  monthlyLabel,
  pendingLabel,
  pendingTooltip,
}: {
  row: IInviteRewardRow;
  monthlyLabel: string;
  pendingLabel: string;
  pendingTooltip: IRewardLabelTooltip;
}) {
  const pending = row.pending?.hasReward ? row.pending : null;
  if (!row.monthlySalesFiatValue && !pending) {
    return null;
  }

  return (
    <XStack ai="center" gap="$1" flexWrap="wrap">
      {row.monthlySalesFiatValue ? (
        <XStack ai="center" gap="$1">
          <SizableText size="$bodySm" color="$textSubdued">
            {monthlyLabel}
          </SizableText>
          <Currency size="$bodySm" formatter="value">
            {row.monthlySalesFiatValue}
          </Currency>
        </XStack>
      ) : null}
      {row.monthlySalesFiatValue && pending ? (
        <SizableText size="$bodySm" color="$textSubdued">
          ·
        </SizableText>
      ) : null}
      {pending ? (
        <XStack ai="center" gap="$1">
          <RewardLabel label={pendingLabel} tooltip={pendingTooltip} />
          <InviteRewardAmount summary={pending} size="$bodySm" />
        </XStack>
      ) : null}
    </XStack>
  );
}

function RewardListRow({
  row,
  title,
  subtitle,
  onPress,
}: {
  row: IInviteRewardRow;
  title: string;
  subtitle?: ReactNode;
  onPress: () => void;
}) {
  return (
    <ListItem
      mx="$0"
      px="$0"
      icon={SUBJECT_ICON[row.subject]}
      title={title}
      subtitle={subtitle}
      drillIn
      onPress={onPress}
    >
      <InviteRewardAmount summary={row.available} emptyLabel />
    </ListItem>
  );
}

const DESKTOP_AMOUNT_COLUMN_WIDTH = 132;
const EMPTY_CELL = '—';

function AmountCell({ children }: { children?: ReactNode }) {
  return (
    <XStack w={DESKTOP_AMOUNT_COLUMN_WIDTH} jc="flex-end" flexShrink={0}>
      {children ?? (
        <SizableText size="$bodyMd" color="$textDisabled">
          {EMPTY_CELL}
        </SizableText>
      )}
    </XStack>
  );
}

// Desktop lists every product on one aligned grid so amounts compare by column.
function DesktopRewardTable({
  rows,
  titleFor,
  monthlyLabel,
  availableLabel,
  pendingLabel,
  availableTooltip,
  pendingTooltip,
  detailsLabel,
  onOpen,
}: {
  rows: IInviteRewardRow[];
  titleFor: (subject: IInviteRewardSubject) => string;
  monthlyLabel: string;
  availableLabel: string;
  pendingLabel: string;
  availableTooltip?: IRewardLabelTooltip;
  pendingTooltip?: IRewardLabelTooltip;
  detailsLabel: string;
  onOpen: (subject: IInviteRewardSubject) => void;
}) {
  return (
    <YStack>
      <XStack ai="center" gap="$3" pb="$2">
        <Stack w="$5" flexShrink={0} />
        <Stack flex={1} />
        <AmountCell>
          <RewardLabel label={monthlyLabel} />
        </AmountCell>
        <AmountCell>
          <RewardLabel label={availableLabel} tooltip={availableTooltip} />
        </AmountCell>
        <AmountCell>
          <RewardLabel label={pendingLabel} tooltip={pendingTooltip} />
        </AmountCell>
        <Stack w={72} flexShrink={0} />
      </XStack>
      {rows.map((row) => (
        <XStack
          key={row.subject}
          ai="center"
          gap="$3"
          py="$3"
          borderTopWidth={1}
          borderColor="$borderSubdued"
          cursor="pointer"
          role="button"
          onPress={() => {
            onOpen(row.subject);
          }}
        >
          <Icon
            name={SUBJECT_ICON[row.subject]}
            size="$5"
            color="$iconSubdued"
            flexShrink={0}
          />
          <SizableText flex={1} size="$bodyLgMedium" numberOfLines={1}>
            {titleFor(row.subject)}
          </SizableText>
          <AmountCell>
            {row.monthlySalesFiatValue ? (
              <Currency size="$bodyMdMedium" formatter="value">
                {row.monthlySalesFiatValue}
              </Currency>
            ) : undefined}
          </AmountCell>
          <AmountCell>
            <InviteRewardAmount
              summary={row.available}
              size="$bodyMdMedium"
              emptyLabel
            />
          </AmountCell>
          <AmountCell>
            {row.pending?.hasReward ? (
              <InviteRewardAmount summary={row.pending} size="$bodyMdMedium" />
            ) : undefined}
          </AmountCell>
          <XStack w={72} jc="flex-end" flexShrink={0}>
            <SizableText size="$bodyMd" color="$textSubdued">
              {`${detailsLabel} ›`}
            </SizableText>
          </XStack>
        </XStack>
      ))}
    </YStack>
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
  const [isFoldedOpen, setIsFoldedOpen] = useState(false);
  const nextDistribution = useNextDistributionLabel(
    summaryInfo.cumulativeRewards.nextDistribution,
  );
  const rows = useMemo(() => getInviteRewardRows(summaryInfo), [summaryInfo]);
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
  // The undistributed hint only makes sense with a payout date.
  const hardwareAvailableTooltip: IRewardLabelTooltip | undefined =
    nextDistribution
      ? {
          title: intl.formatMessage({
            id: ETranslations.referral_hw_undistributed_pop_title,
          }),
          content: intl.formatMessage(
            { id: ETranslations.referral_hw_undistributed_pop },
            { date: nextDistribution },
          ),
        }
      : undefined;
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

  return (
    <YStack px="$pagePadding" pt="$4">
      <SizableText size="$headingSm" pb="$2">
        {INVITE_COPY.rewardsByProduct}
      </SizableText>
      {md ? (
        rows.visibleRows.map((row) => (
          <RewardListRow
            key={row.subject}
            row={row}
            title={titleFor(row.subject)}
            subtitle={
              row.subject === 'hardware' ? (
                <HardwareSubtitle
                  row={row}
                  monthlyLabel={monthlyLabel}
                  pendingLabel={pendingLabel}
                  pendingTooltip={hardwarePendingTooltip}
                />
              ) : undefined
            }
            onPress={() => {
              openSubject(row.subject);
            }}
          />
        ))
      ) : (
        <DesktopRewardTable
          rows={rows.visibleRows}
          titleFor={titleFor}
          monthlyLabel={monthlyLabel}
          availableLabel={availableLabel}
          pendingLabel={pendingLabel}
          availableTooltip={hardwareAvailableTooltip}
          pendingTooltip={hardwarePendingTooltip}
          detailsLabel={INVITE_COPY.details}
          onOpen={openSubject}
        />
      )}
      {rows.foldedRows.length > 0 ? (
        <ListItem
          mx="$0"
          px="$0"
          title={foldedTitle}
          drillIn
          onPress={() => {
            setIsFoldedOpen((open) => !open);
          }}
        >
          <SizableText size="$bodyMd" color="$textSubdued">
            {noRewardLabel}
          </SizableText>
        </ListItem>
      ) : null}
      {isFoldedOpen
        ? rows.foldedRows.map((row) => (
            <RewardListRow
              key={row.subject}
              row={row}
              title={titleFor(row.subject)}
              onPress={() => {
                openSubject(row.subject);
              }}
            />
          ))
        : null}
    </YStack>
  );
}
