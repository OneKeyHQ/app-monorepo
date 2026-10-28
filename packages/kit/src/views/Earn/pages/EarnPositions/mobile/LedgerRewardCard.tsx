import { useIntl } from 'react-intl';

import { SizableText, Stack, XStack, YStack } from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import {
  BALANCE_FLEX_WITHOUT_REWARDS,
  POSITION_COLUMN_WIDTH,
  PROTOCOL_TABLE_COLUMN_GAP,
  USD_FLEX_WITHOUT_REWARDS,
} from '@onekeyhq/kit/src/views/Home/components/DeFiListBlock/ProtocolUnifiedTable';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { useSettingsValuePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import type {
  IEarnRewardsPortfolioGroup,
  IEarnRewardsPortfolioItem,
  IEarnRewardsPortfolioStage,
} from '@onekeyhq/shared/types/staking';

import { TransactionLink } from '../../EarnProtocolDetails/mobile/TransactionLink';

import { REWARD_ACTION_COLUMN_WIDTH } from './ClaimableRewardRow';
import { usePortfolioTableLayout } from './portfolioTableLayout';

/** What a server-formatted amount reads as under the hide-balances switch. */
const HIDDEN_AMOUNT = { text: '****' };

function FactRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <XStack ai="center" jc="space-between" gap="$3" minHeight={28}>
      <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
        {label}
      </SizableText>
      {children}
    </XStack>
  );
}

function timeLabelIdOf(stage: IEarnRewardsPortfolioStage) {
  return stage === 'distributed'
    ? ETranslations.earn_distributed_time__title
    : ETranslations.earn_est_distribute_time__title;
}

/** The payout date the reward's stage is about, when the server has one. */
export function ledgerTimeOf(item: IEarnRewardsPortfolioItem) {
  return item.stage === 'distributed' ? item.distributedAt : item.availableAt;
}

/**
 * The wide layout's header strip over a group's ledger rewards, in the
 * holdings tables' columns: the amount, the payout date the stage is
 * about (or, when no reward has one, the Position column the other groups
 * have), the value and, once paid, the transaction.
 */
export function LedgerRewardTableHeader({
  stage,
  hasTime,
}: {
  stage: IEarnRewardsPortfolioStage;
  hasTime: boolean;
}) {
  const intl = useIntl();
  return (
    <XStack
      px="$2"
      py="$2"
      ai="center"
      bg="$bgSubdued"
      gap={PROTOCOL_TABLE_COLUMN_GAP}
    >
      <Stack width={POSITION_COLUMN_WIDTH} flexShrink={0} minWidth={0}>
        <SizableText size="$bodySmMedium" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.wallet_defi_portfolio_column_amount,
          })}
        </SizableText>
      </Stack>
      <Stack flex={BALANCE_FLEX_WITHOUT_REWARDS} flexBasis={0} minWidth={0}>
        <SizableText size="$bodySmMedium" color="$textSubdued">
          {intl.formatMessage({
            id: hasTime ? timeLabelIdOf(stage) : ETranslations.label_position,
          })}
        </SizableText>
      </Stack>
      <Stack
        flex={USD_FLEX_WITHOUT_REWARDS}
        flexBasis={0}
        minWidth={0}
        ai="flex-end"
      >
        <SizableText size="$bodySmMedium" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_value })}
        </SizableText>
      </Stack>
      <Stack width={REWARD_ACTION_COLUMN_WIDTH} flexShrink={0} />
    </XStack>
  );
}

/**
 * The wide layout's ledger reward: one table line under
 * LedgerRewardTableHeader with the card's facts in its columns.
 */
function LedgerRewardTableRow({
  item,
  group,
}: {
  item: IEarnRewardsPortfolioItem;
  group: IEarnRewardsPortfolioGroup;
}) {
  const currencyInfo = useCurrency();
  const [{ hideValue }] = useSettingsValuePersistAtom();
  const isDistributed = item.stage === 'distributed';
  const time = ledgerTimeOf(item);
  return (
    <XStack
      px="$2"
      py="$2"
      ai="center"
      minHeight={52}
      gap={PROTOCOL_TABLE_COLUMN_GAP}
    >
      <XStack
        width={POSITION_COLUMN_WIDTH}
        flexShrink={0}
        minWidth={0}
        ai="center"
        gap="$2"
      >
        <Token size="sm" tokenImageUri={item.token.info.logoURI} />
        {/* the amount comes formatted from the server: hidden as a whole */}
        <EarnText
          text={hideValue ? HIDDEN_AMOUNT : item.title}
          size="$bodyMdMedium"
          numberOfLines={1}
          flex={1}
          minWidth={0}
        />
      </XStack>
      <Stack flex={BALANCE_FLEX_WITHOUT_REWARDS} flexBasis={0} minWidth={0}>
        {/* The ledger names no position: "–" holds the column */}
        {time ? (
          <SizableText size="$bodyMd" numberOfLines={1}>
            {formatDate(new Date(time), { hideTimeForever: true })}
          </SizableText>
        ) : (
          <SizableText size="$bodyMd" color="$textSubdued">
            –
          </SizableText>
        )}
      </Stack>
      <Stack
        flex={USD_FLEX_WITHOUT_REWARDS}
        flexBasis={0}
        minWidth={0}
        ai="flex-end"
      >
        {item.fiatValue ? (
          <NumberSizeableTextWrapper
            hideValue
            size="$bodyMdMedium"
            formatter="value"
            formatterOptions={{ currency: currencyInfo.symbol }}
            numberOfLines={1}
          >
            {item.fiatValue}
          </NumberSizeableTextWrapper>
        ) : null}
      </Stack>
      <XStack width={REWARD_ACTION_COLUMN_WIDTH} flexShrink={0} jc="flex-end">
        {isDistributed && item.txHash ? (
          <TransactionLink networkId={group.networkId} txHash={item.txHash} />
        ) : null}
      </XStack>
    </XStack>
  );
}

/**
 * One Pending / Distributed ledger reward as its own card (figma
 * 29180-109399 / 29180-109764): the token on top, then the reward as fiat
 * with the token amount under it (the figure style of every other card),
 * the payout date the stage is about, and for distributed rows the
 * transaction. The wide layout reads it as a table line instead.
 */
export function LedgerRewardCard({
  item,
  group,
}: {
  item: IEarnRewardsPortfolioItem;
  group: IEarnRewardsPortfolioGroup;
}) {
  if (usePortfolioTableLayout()) {
    return <LedgerRewardTableRow item={item} group={group} />;
  }
  return <LedgerRewardFactCard item={item} group={group} />;
}

function LedgerRewardFactCard({
  item,
  group,
}: {
  item: IEarnRewardsPortfolioItem;
  group: IEarnRewardsPortfolioGroup;
}) {
  const intl = useIntl();
  const currencyInfo = useCurrency();
  const [{ hideValue }] = useSettingsValuePersistAtom();
  const isDistributed = item.stage === 'distributed';
  const time = ledgerTimeOf(item);
  const timeLabel = intl.formatMessage({ id: timeLabelIdOf(item.stage) });

  return (
    <YStack
      gap="$1"
      p="$3"
      borderRadius="$3"
      borderWidth="$px"
      borderColor="$borderSubdued"
      bg="$bg"
    >
      <XStack ai="center" gap="$2" pb="$1">
        <Token
          size="sm"
          tokenImageUri={item.token.info.logoURI}
          showNetworkIcon
          networkId={group.networkId}
        />
        <SizableText size="$bodyMdMedium" numberOfLines={1}>
          {item.token.info.symbol}
        </SizableText>
      </XStack>
      <FactRow label={intl.formatMessage({ id: ETranslations.earn_rewards })}>
        <YStack ai="flex-end" flexShrink={1}>
          {item.fiatValue ? (
            <NumberSizeableTextWrapper
              hideValue
              size="$bodySmMedium"
              formatter="value"
              formatterOptions={{ currency: currencyInfo.symbol }}
              numberOfLines={1}
            >
              {item.fiatValue}
            </NumberSizeableTextWrapper>
          ) : null}
          {/* the amount comes formatted from the server: hidden as a whole */}
          <EarnText
            text={hideValue ? HIDDEN_AMOUNT : item.title}
            size={item.fiatValue ? '$bodySm' : '$bodySmMedium'}
            color={item.fiatValue ? '$textSubdued' : '$textSuccess'}
            numberOfLines={1}
          />
        </YStack>
      </FactRow>
      {time ? (
        <FactRow label={timeLabel}>
          <SizableText size="$bodySmMedium" numberOfLines={1}>
            {formatDate(new Date(time), { hideTimeForever: true })}
          </SizableText>
        </FactRow>
      ) : null}
      {isDistributed && item.txHash ? (
        <FactRow
          label={intl.formatMessage({
            id: ETranslations.global_transaction_id,
          })}
        >
          <TransactionLink networkId={group.networkId} txHash={item.txHash} />
        </FactRow>
      ) : null}
    </YStack>
  );
}
