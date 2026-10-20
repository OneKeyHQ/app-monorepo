import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  getHyperliquidTokenImageUris,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';

import { simplePrice } from '../../utils/simpleDisplay';

import { simplePerpsCardStyle, simplePerpsDividerStyle } from './simpleStyles';
import { SimpleValue } from './SimpleValue';

import type { ISimpleOrderSummaryData } from '../../utils/simpleOrderSummary';

export function SimpleOrderSummary({
  coin,
  side,
  reduceOnly,
  orderType,
  size,
  price,
  onPress,
  details,
  actions,
  hideValue = false,
}: ISimpleOrderSummaryData & {
  onPress?: () => void;
  details?: { label: string; value: string }[];
  actions?: ReactNode;
  hideValue?: boolean;
}) {
  const intl = useIntl();
  const priceDisplay = price ? simplePrice(price) : '--';
  const typeLabels: Record<string, ETranslations> = {
    Market: ETranslations.perp_position_market,
    Limit: ETranslations.perp_position_limit,
    'Stop Market': ETranslations.perp_order_stop_market,
    'Stop Limit': ETranslations.perp_order_stop_limit,
    'Take Profit Market': ETranslations.perp_order_tp_market,
    'Take Profit Limit': ETranslations.perp_order_tp_limit,
  };
  let sideLabel =
    side === 'B'
      ? ETranslations.perp_trade_long
      : ETranslations.perp_trade_short;
  if (reduceOnly) {
    sideLabel =
      side === 'B'
        ? ETranslations.perp_order_close_short
        : ETranslations.perp_order_close_long;
  }
  const typeLabel = typeLabels[orderType];
  return (
    <YStack
      testID={`perps-simple-order-${coin}`}
      minHeight={details ? undefined : 72}
      justifyContent={details ? undefined : 'center'}
      mx="$0"
      my="$0"
      p={details ? '$5' : '$4'}
      {...simplePerpsCardStyle}
      borderRadius="$6"
      gap={details ? '$4' : '$3'}
      onPress={onPress}
      hoverStyle={onPress ? { bg: '$bgHover' } : undefined}
      pressStyle={onPress ? { bg: '$bgActive' } : undefined}
      accessibilityRole={onPress ? 'button' : undefined}
      cursor={onPress ? 'pointer' : undefined}
    >
      <XStack width="100%" gap="$2.5" alignItems="center">
        <Token
          size="lg"
          borderRadius="$full"
          tokenImageUris={getHyperliquidTokenImageUris(coin)}
          fallbackIcon="CryptoCoinOutline"
        />
        <YStack flex={1} minWidth={0} gap="$1">
          <XStack gap="$2" alignItems="baseline" justifyContent="space-between">
            <SizableText
              size={details ? '$bodyLgMedium' : '$bodyMdMedium'}
              numberOfLines={1}
              flexShrink={1}
            >
              {parseDexCoin(coin).displayName}
            </SizableText>
            <SizableText
              size={details ? '$bodyLgMedium' : '$bodyMdMedium'}
              flexShrink={0}
            >
              {hideValue ? '****' : priceDisplay}
            </SizableText>
          </XStack>
          <XStack gap="$2" justifyContent="space-between" alignItems="baseline">
            <XStack
              gap="$1.5"
              flexWrap="wrap"
              alignItems="baseline"
              flex={1}
              minWidth={0}
            >
              <SizableText
                size="$bodySm"
                color={side === 'B' ? '$textSuccess' : '$textCritical'}
              >
                {intl.formatMessage({ id: sideLabel })}
              </SizableText>
              <SizableText size="$bodySm" color="$textDisabled">
                |
              </SizableText>
              <SizableText size="$bodySm" color="$textSubdued">
                {typeLabel ? intl.formatMessage({ id: typeLabel }) : orderType}
              </SizableText>
            </XStack>
            <XStack gap="$1" alignItems="baseline" flexShrink={0}>
              {hideValue || size === '--' ? (
                <SizableText size="$bodySm" color="$textSubdued">
                  {hideValue ? '****' : '--'}
                </SizableText>
              ) : (
                <NumberSizeableText
                  size="$bodySm"
                  color="$textSubdued"
                  formatter="balance"
                >
                  {size}
                </NumberSizeableText>
              )}
              {size !== '--' ? (
                <SizableText size="$bodySm" color="$textSubdued">
                  {parseDexCoin(coin).displayName}
                </SizableText>
              ) : null}
            </XStack>
          </XStack>
        </YStack>
      </XStack>
      {details ? (
        <>
          <YStack height={1} {...simplePerpsDividerStyle} mx="$-5" />
          <YStack gap="$1">
            {details.map((detail) => (
              <SimpleValue
                key={detail.label}
                label={detail.label}
                value={hideValue ? '****' : detail.value}
                compact
              />
            ))}
          </YStack>
        </>
      ) : null}
      {actions}
    </YStack>
  );
}
