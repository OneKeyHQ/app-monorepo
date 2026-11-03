import { useIntl } from 'react-intl';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
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

import {
  RewardTableLine,
  RewardTableStrip,
  rewardTableColumns,
} from './ClaimableRewardRow';
import { usePortfolioTableLayout } from './portfolioTableLayout';

import type { IPositionTableColumns } from '../desktop/positionTableLayout';

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

/** Whether a ledger reward's table line has an action: a paid one's transaction */
export function ledgerRewardHasAction(item: IEarnRewardsPortfolioItem) {
  return item.stage === 'distributed' && Boolean(item.txHash);
}

/** A ledger group's rewards table columns */
export function ledgerRewardTableColumns(
  items: IEarnRewardsPortfolioItem[],
): IPositionTableColumns {
  return rewardTableColumns(items.some(ledgerRewardHasAction));
}

/**
 * The wide layout's header strip over a group's ledger rewards, in the
 * holdings tables' columns: the amount, the payout date the stage is
 * about (or, when no reward has one, the Position column the other groups
 * have) and the value; a paid reward's transaction goes where the
 * placement puts a row's action.
 */
export function LedgerRewardTableHeader({
  stage,
  hasTime,
  columns,
}: {
  stage: IEarnRewardsPortfolioStage;
  hasTime: boolean;
  columns: IPositionTableColumns;
}) {
  const intl = useIntl();
  return (
    <RewardTableStrip
      columns={columns}
      first={intl.formatMessage({
        id: ETranslations.wallet_defi_portfolio_column_amount,
      })}
      second={intl.formatMessage({
        id: hasTime ? timeLabelIdOf(stage) : ETranslations.label_position,
      })}
    />
  );
}

/**
 * The wide layout's ledger reward: one table line under
 * LedgerRewardTableHeader with the card's facts in its columns.
 */
function LedgerRewardTableRow({
  item,
  group,
  columns,
}: {
  item: IEarnRewardsPortfolioItem;
  group: IEarnRewardsPortfolioGroup;
  columns: IPositionTableColumns;
}) {
  const currencyInfo = useCurrency();
  const [{ hideValue }] = useSettingsValuePersistAtom();
  const time = ledgerTimeOf(item);
  return (
    <RewardTableLine
      columns={columns}
      logoURI={item.token.info.logoURI}
      title={
        // the amount comes formatted from the server: hidden as a whole
        <EarnText
          text={hideValue ? HIDDEN_AMOUNT : item.title}
          size="$bodyMdMedium"
          numberOfLines={1}
        />
      }
      second={
        // The ledger names no position: "–" holds the column
        time ? (
          <SizableText size="$bodyMd" numberOfLines={1}>
            {formatDate(new Date(time), { hideTimeForever: true })}
          </SizableText>
        ) : (
          <SizableText size="$bodyMd" color="$textSubdued">
            –
          </SizableText>
        )
      }
      value={
        item.fiatValue ? (
          <NumberSizeableTextWrapper
            hideValue
            size="$bodyMdMedium"
            formatter="value"
            formatterOptions={{ currency: currencyInfo.symbol }}
            numberOfLines={1}
          >
            {item.fiatValue}
          </NumberSizeableTextWrapper>
        ) : null
      }
      action={
        ledgerRewardHasAction(item) && item.txHash ? (
          <TransactionLink networkId={group.networkId} txHash={item.txHash} />
        ) : null
      }
    />
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
  columns,
}: {
  item: IEarnRewardsPortfolioItem;
  group: IEarnRewardsPortfolioGroup;
  /** the wide layout's table columns (ledgerRewardTableColumns) */
  columns?: IPositionTableColumns;
}) {
  if (usePortfolioTableLayout()) {
    return (
      <LedgerRewardTableRow
        item={item}
        group={group}
        columns={columns ?? rewardTableColumns(ledgerRewardHasAction(item))}
      />
    );
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
