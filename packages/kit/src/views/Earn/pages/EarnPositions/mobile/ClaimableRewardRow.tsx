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
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { usePortfolioTableLayout } from './portfolioTableLayout';

// The wide layout's action column, as wide as the holdings tables' one
export const REWARD_ACTION_COLUMN_WIDTH = 112;

/**
 * The wide layout's header strip over a group's reward rows, in the
 * holdings tables' columns: the reward's amount, the position it came
 * from, its value and the row's action.
 */
export function RewardTableHeader() {
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
          {intl.formatMessage({ id: ETranslations.label_position })}
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
}: {
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
          <Token size="sm" tokenImageUri={logoURI} />
          <Stack flex={1} minWidth={0}>
            {titleNode}
          </Stack>
        </XStack>
        <Stack flex={BALANCE_FLEX_WITHOUT_REWARDS} flexBasis={0} minWidth={0}>
          {subtitleNode}
        </Stack>
        <Stack
          flex={USD_FLEX_WITHOUT_REWARDS}
          flexBasis={0}
          minWidth={0}
          ai="flex-end"
        >
          {fiatNode}
        </Stack>
        <XStack width={REWARD_ACTION_COLUMN_WIDTH} flexShrink={0} jc="flex-end">
          {action}
        </XStack>
      </XStack>
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
