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
  // Phone overview puts the bar on its own row. Desktop keeps it between columns.
  stacked?: boolean;
}

export function ActivitySummaryRow({
  timeRange,
  buyCount,
  sellCount,
  buyVolume,
  sellVolume,
  totalVolume,
  isLoading,
  stacked = false,
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
  const noVolumeData =
    totalVolume === undefined ||
    totalVolume <= 0 ||
    buyVolume === undefined ||
    sellVolume === undefined;
  const ratioBar = (
    <BuySellRatioBar
      buyPercentage={buyPercentage}
      height={6}
      isLoading={isLoading}
      noData={noVolumeData}
    />
  );

  return (
    <XStack
      testID="market-token-activity-summary-row"
      px={stacked ? undefined : '$0.5'}
      gap={stacked ? '$4' : '$2.5'}
      alignItems={stacked ? 'flex-start' : 'center'}
      flexWrap={stacked ? 'wrap' : undefined}
    >
      {stacked ? <Stack width="100%">{ratioBar}</Stack> : null}
      {/* Figma sizes both blocks at 160px, but that clips CJK and the longer
      European translations onto a second line. 160 becomes the floor and the
      block grows with its own text; the bar between them takes what is left. */}
      <YStack
        minWidth={stacked ? 0 : 160}
        flex={stacked ? 1 : undefined}
        flexShrink={stacked ? 1 : 0}
        gap="$1.5"
        alignItems="flex-start"
      >
        <XStack gap="$1" alignItems="center">
          <SizableText size="$bodyMdMedium">
            {intl.formatMessage(
              { id: ETranslations.market_total_vol_in_range },
              { range: timeRange },
            )}
          </SizableText>
          {volumeUnavailable ? (
            <SizableText size="$headingSm">--</SizableText>
          ) : (
            <NumberSizeableText
              size="$headingSm"
              formatter="marketCap"
              formatterOptions={{ currency: '$' }}
            >
              {totalVolume}
            </NumberSizeableText>
          )}
        </XStack>
        <XStack gap="$1" alignItems="center">
          <SizableText size="$bodyMdMedium" color="$textSuccess">
            {intl.formatMessage({
              id: ETranslations.dexmarket_details_transactions_buy,
            })}
          </SizableText>
          <XStack alignItems="center">
            {buyUnavailable ? (
              <SizableText size="$bodyMd" color="$textSubdued">
                --
              </SizableText>
            ) : (
              <NumberSizeableText
                size="$bodyMd"
                color="$textSubdued"
                formatter="marketCap"
              >
                {buyCount}
              </NumberSizeableText>
            )}
            <SizableText size="$bodyMd" color="$textSubdued">
              {' / '}
            </SizableText>
            {buyVolumeUnavailable ? (
              <SizableText size="$bodyMd" color="$textSubdued">
                --
              </SizableText>
            ) : (
              <NumberSizeableText
                size="$bodyMd"
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

      {stacked ? null : (
        <Stack flex={1} minWidth={0}>
          {ratioBar}
        </Stack>
      )}

      <YStack
        minWidth={stacked ? 0 : 160}
        flex={stacked ? 1 : undefined}
        flexShrink={stacked ? 1 : 0}
        gap="$1.5"
        alignItems="flex-end"
      >
        <XStack gap="$1" alignItems="center" justifyContent="flex-end">
          <SizableText size="$bodyMdMedium">
            {intl.formatMessage({ id: ETranslations.market_net_vol })}
          </SizableText>
          {netVolumeUnavailable ? (
            <SizableText size="$headingSm">--</SizableText>
          ) : (
            <NumberSizeableText
              size="$headingSm"
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
              <SizableText size="$bodyMd" color="$textSubdued">
                --
              </SizableText>
            ) : (
              <NumberSizeableText
                size="$bodyMd"
                color="$textSubdued"
                formatter="marketCap"
              >
                {sellCount}
              </NumberSizeableText>
            )}
            <SizableText size="$bodyMd" color="$textSubdued">
              {' / '}
            </SizableText>
            {sellVolumeUnavailable ? (
              <SizableText size="$bodyMd" color="$textSubdued">
                --
              </SizableText>
            ) : (
              <NumberSizeableText
                size="$bodyMd"
                color="$textSubdued"
                formatter="marketCap"
                formatterOptions={{ currency: '$' }}
              >
                {sellVolume}
              </NumberSizeableText>
            )}
          </XStack>
          <SizableText size="$bodyMdMedium" color="$textCritical">
            {intl.formatMessage({
              id: ETranslations.dexmarket_details_transactions_sell,
            })}
          </SizableText>
        </XStack>
      </YStack>
    </XStack>
  );
}
