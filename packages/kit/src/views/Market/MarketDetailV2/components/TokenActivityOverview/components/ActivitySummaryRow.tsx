import { useIntl } from 'react-intl';

import {
  NumberSizeableText,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { BuySellRatioBar } from './BuySellRatioBar';

interface IActivitySummaryRowProps {
  timeRange: string;
  buyCount?: number;
  sellCount?: number;
  buyVolume?: number;
  sellVolume?: number;
  totalVolume?: number;
  isLoading?: boolean;
}

export function ActivitySummaryRow({
  timeRange,
  buyCount,
  sellCount,
  buyVolume,
  sellVolume,
  totalVolume,
  isLoading,
}: IActivitySummaryRowProps) {
  const intl = useIntl();
  const buyPercentage =
    totalVolume !== undefined && totalVolume > 0 && buyVolume !== undefined
      ? (buyVolume / totalVolume) * 100
      : 0;
  const netVolume =
    buyVolume !== undefined && sellVolume !== undefined
      ? buyVolume - sellVolume
      : undefined;
  let netVolumeColor: '$text' | '$textSuccess' | '$textCritical' = '$text';
  if (netVolume !== undefined && netVolume > 0) {
    netVolumeColor = '$textSuccess';
  } else if (netVolume !== undefined && netVolume < 0) {
    netVolumeColor = '$textCritical';
  }
  const volumeUnavailable = isLoading || totalVolume === undefined;
  const netVolumeUnavailable = isLoading || netVolume === undefined;
  const buyUnavailable = isLoading || buyCount === undefined;
  const sellUnavailable = isLoading || sellCount === undefined;
  const buyVolumeUnavailable = isLoading || buyVolume === undefined;
  const sellVolumeUnavailable = isLoading || sellVolume === undefined;

  return (
    <XStack
      testID="market-token-activity-summary-row"
      px="$0.5"
      gap="$2.5"
      alignItems="center"
    >
      <YStack minWidth={160} maxWidth={160} gap="$2" alignItems="flex-start">
        <XStack gap="$1" alignItems="center">
          <SizableText size="$bodyLgMedium" color="$textSubdued">
            {intl.formatMessage(
              { id: ETranslations.market_total_vol_in_range },
              { range: timeRange },
            )}
          </SizableText>
          {volumeUnavailable ? (
            <SizableText size="$bodyLgMedium">--</SizableText>
          ) : (
            <NumberSizeableText
              size="$bodyLgMedium"
              formatter="marketCap"
              formatterOptions={{ currency: '$' }}
            >
              {totalVolume}
            </NumberSizeableText>
          )}
        </XStack>
        <XStack gap="$1" alignItems="center">
          <SizableText size="$bodySmMedium" color="$textSuccess">
            {intl.formatMessage({
              id: ETranslations.dexmarket_details_transactions_buy,
            })}
          </SizableText>
          <XStack alignItems="center">
            {buyUnavailable ? (
              <SizableText size="$bodySm" color="$textSubdued">
                --
              </SizableText>
            ) : (
              <NumberSizeableText
                size="$bodySm"
                color="$textSubdued"
                formatter="marketCap"
              >
                {buyCount}
              </NumberSizeableText>
            )}
            <SizableText size="$bodySm" color="$textSubdued">
              {' / '}
            </SizableText>
            {buyVolumeUnavailable ? (
              <SizableText size="$bodySm" color="$textSubdued">
                --
              </SizableText>
            ) : (
              <NumberSizeableText
                size="$bodySm"
                color="$textSubdued"
                formatter="marketCap"
                formatterOptions={{ currency: '$' }}
              >
                {buyVolume}
              </NumberSizeableText>
            )}
          </XStack>
        </XStack>
      </YStack>

      <Stack flex={1} minWidth={0}>
        <BuySellRatioBar
          buyPercentage={buyPercentage}
          height={6}
          isLoading={isLoading}
          noData={buyVolume === undefined || sellVolume === undefined}
        />
      </Stack>

      <YStack minWidth={160} maxWidth={160} gap="$2" alignItems="flex-end">
        <XStack gap="$1" alignItems="center" justifyContent="flex-end">
          <SizableText size="$bodyLgMedium" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.market_net_vol })}
          </SizableText>
          {netVolumeUnavailable ? (
            <SizableText size="$bodyLgMedium">--</SizableText>
          ) : (
            <NumberSizeableText
              size="$bodyLgMedium"
              color={netVolumeColor}
              formatter="marketCap"
              formatterOptions={{
                currency: '$',
                showPlusMinusSigns: true,
              }}
            >
              {netVolume}
            </NumberSizeableText>
          )}
        </XStack>
        <XStack gap="$1" alignItems="center" justifyContent="flex-end">
          <XStack alignItems="center">
            {sellUnavailable ? (
              <SizableText size="$bodySm" color="$textSubdued">
                --
              </SizableText>
            ) : (
              <NumberSizeableText
                size="$bodySm"
                color="$textSubdued"
                formatter="marketCap"
              >
                {sellCount}
              </NumberSizeableText>
            )}
            <SizableText size="$bodySm" color="$textSubdued">
              {' / '}
            </SizableText>
            {sellVolumeUnavailable ? (
              <SizableText size="$bodySm" color="$textSubdued">
                --
              </SizableText>
            ) : (
              <NumberSizeableText
                size="$bodySm"
                color="$textSubdued"
                formatter="marketCap"
                formatterOptions={{ currency: '$' }}
              >
                {sellVolume}
              </NumberSizeableText>
            )}
          </XStack>
          <SizableText size="$bodySmMedium" color="$textCritical">
            {intl.formatMessage({
              id: ETranslations.dexmarket_details_transactions_sell,
            })}
          </SizableText>
        </XStack>
      </YStack>
    </XStack>
  );
}
