import { useIntl } from 'react-intl';

import { SizableText, Stack, XStack, YStack } from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { PROTOCOL_TABLE_COLUMN_GAP } from '@onekeyhq/kit/src/views/Home/components/DeFiListBlock/ProtocolUnifiedTable';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  TOTAL_CHEVRON_SLOT,
  positionTableColumns,
} from '../desktop/positionTableLayout';

import { usePortfolioTableLayout } from './portfolioTableLayout';

import type { IPositionTableColumns } from '../desktop/positionTableLayout';

// A rewards table's second column names the position (or the payout date):
// wider than an amount where the placement fixes it
const REWARD_EDGE_SECOND_COLUMN_WIDTH = 240;

/**
 * A group's rewards table columns, as the holdings tables place a row's
 * action (demo 11-03); the values end under the group's total
 */
export function rewardTableColumns(hasActions: boolean): IPositionTableColumns {
  return positionTableColumns({
    hasActions,
    endInset: TOTAL_CHEVRON_SLOT,
    edgeSecondWidth: REWARD_EDGE_SECOND_COLUMN_WIDTH,
  });
}

/**
 * The header strip over a group's rewards table, the holdings tables'
 * strip: three labels in the table's columns. No room held for the rows'
 * actions; where they go is the placement's
 */
export function RewardTableStrip({
  columns,
  first,
  second,
}: {
  columns: IPositionTableColumns;
  first: string;
  second: string;
}) {
  const intl = useIntl();
  return (
    <XStack
      {...columns.inset}
      py="$2"
      ai="center"
      bg="$bgSubdued"
      gap={PROTOCOL_TABLE_COLUMN_GAP}
    >
      <Stack {...columns.first}>
        <SizableText
          size="$bodySmMedium"
          color="$textSubdued"
          numberOfLines={1}
        >
          {first}
        </SizableText>
      </Stack>
      <Stack {...columns.second}>
        <SizableText
          size="$bodySmMedium"
          color="$textSubdued"
          numberOfLines={1}
        >
          {second}
        </SizableText>
      </Stack>
      <Stack {...columns.value}>
        <SizableText
          size="$bodySmMedium"
          color="$textSubdued"
          numberOfLines={1}
        >
          {intl.formatMessage({ id: ETranslations.global_value })}
        </SizableText>
      </Stack>
    </XStack>
  );
}

/**
 * The wide layout's header strip over a group's reward rows, in the
 * holdings tables' columns: the reward's amount, the position it came
 * from and its value.
 */
export function RewardTableHeader({
  columns,
}: {
  columns: IPositionTableColumns;
}) {
  const intl = useIntl();
  return (
    <RewardTableStrip
      columns={columns}
      first={intl.formatMessage({
        id: ETranslations.wallet_defi_portfolio_column_amount,
      })}
      second={intl.formatMessage({ id: ETranslations.label_position })}
    />
  );
}

/**
 * A rewards table line in the table's columns: the token and amount, the
 * second column, the value, and the row's action where the placement puts
 * it (beside the amount, or at the card's edge)
 */
export function RewardTableLine({
  columns,
  logoURI,
  title,
  second,
  value,
  action,
}: {
  columns: IPositionTableColumns;
  logoURI?: string;
  title: React.ReactNode;
  second: React.ReactNode;
  value: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <XStack
      {...columns.inset}
      py="$2"
      ai="center"
      minHeight={52}
      gap={PROTOCOL_TABLE_COLUMN_GAP}
    >
      <XStack {...columns.first} ai="center" gap="$2">
        <Token size="sm" tokenImageUri={logoURI} />
        <Stack flex={1} minWidth={0}>
          {title}
        </Stack>
        {columns.placement === 'name' && action ? (
          <XStack flexShrink={0} ml="$1">
            {action}
          </XStack>
        ) : null}
      </XStack>
      <Stack {...columns.second}>{second}</Stack>
      <Stack {...columns.value}>{value}</Stack>
      {columns.trailing && action ? (
        <XStack {...columns.trailing}>{action}</XStack>
      ) : null}
    </XStack>
  );
}

/**
 * One claimable reward on the Rewards tab (figma 30490-21537): the token,
 * the amount with where it came from under it, the fiat on the right and
 * the row's action — Claim for a reward the server attached a claim to. The
 * wide layout spreads the same row over the holdings tables' columns.
 */
export function ClaimableRewardRow({
  networkId,
  logoURI,
  title,
  subtitle,
  fiatValue,
  isValueUnknown = false,
  action,
  columns,
}: {
  /** the wide layout's table columns (rewardTableColumns) */
  columns?: IPositionTableColumns;
  networkId: string;
  logoURI?: string;
  /** the amount line, "2.40 USDC" */
  title: React.ReactNode;
  /** the vault or market the reward came from */
  subtitle?: React.ReactNode;
  /** nothing when the server has not priced the reward */
  fiatValue?: string | number;
  /** the amount itself is unknown (Lista's, until Check): "–" for its value */
  isValueUnknown?: boolean;
  action?: React.ReactNode;
}) {
  const currencyInfo = useCurrency();
  const isTableLayout = usePortfolioTableLayout();
  const titleNode =
    typeof title === 'string' ? (
      <SizableText size="$bodyMdMedium" numberOfLines={1}>
        {title}
      </SizableText>
    ) : (
      title
    );
  const subtitleNode =
    typeof subtitle === 'string' ? (
      <SizableText
        size={isTableLayout ? '$bodyMd' : '$bodySm'}
        color={isTableLayout ? '$text' : '$textSubdued'}
        numberOfLines={1}
      >
        {subtitle}
      </SizableText>
    ) : (
      subtitle
    );
  let fiatNode: React.ReactNode = null;
  if (isValueUnknown) {
    fiatNode = (
      <SizableText
        size={isTableLayout ? '$bodyMdMedium' : '$bodyMd'}
        color="$textSubdued"
      >
        –
      </SizableText>
    );
  } else if (fiatValue !== undefined && fiatValue !== '') {
    fiatNode = (
      <NumberSizeableTextWrapper
        hideValue
        size={isTableLayout ? '$bodyMdMedium' : '$bodyMd'}
        color={isTableLayout ? undefined : '$textSubdued'}
        formatter="value"
        formatterOptions={{ currency: currencyInfo.symbol }}
        numberOfLines={1}
      >
        {fiatValue}
      </NumberSizeableTextWrapper>
    );
  }

  if (isTableLayout) {
    return (
      <RewardTableLine
        columns={columns ?? rewardTableColumns(Boolean(action))}
        logoURI={logoURI}
        title={titleNode}
        second={subtitleNode}
        value={fiatNode}
        action={action}
      />
    );
  }

  return (
    <XStack minHeight={44} ai="center" jc="space-between" gap="$3">
      <XStack ai="center" gap="$2.5" flex={1} minWidth={0}>
        <Token
          size="md"
          tokenImageUri={logoURI}
          showNetworkIcon
          networkId={networkId}
        />
        <YStack flex={1} minWidth={0} gap="$0.5">
          {titleNode}
          {subtitleNode}
        </YStack>
      </XStack>
      <XStack ai="center" gap="$2" flexShrink={0}>
        {fiatNode}
        {action}
      </XStack>
    </XStack>
  );
}
