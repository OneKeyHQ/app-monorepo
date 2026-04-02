import { useIntl } from 'react-intl';

import { NumberSizeableText, SizableText, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { BuySellRatioBar } from './BuySellRatioBar';

import type { IVolumeRowProps } from '../types';

export function VolumeRow({
  label,
  buyVolume,
  sellVolume,
  totalVolume,
  isLoading,
}: IVolumeRowProps) {
  const intl = useIntl();
  const buyPercentage =
    totalVolume !== undefined && totalVolume > 0 && buyVolume !== undefined
      ? (buyVolume / totalVolume) * 100
      : 0;

  // Show "--" when loading OR when data is undefined (field doesn't exist)
  const showTotalPlaceholder = isLoading || totalVolume === undefined;
  const showBuyPlaceholder = isLoading || buyVolume === undefined;
  const showSellPlaceholder = isLoading || sellVolume === undefined;
  const noData = buyVolume === undefined || sellVolume === undefined;

  return (
    <Stack gap="$2">
      <Stack flexDirection="row" alignItems="center" gap="$2">
        <SizableText size="$bodyMdMedium">
          {label}:{' '}
          {showTotalPlaceholder ? (
            '--'
          ) : (
            <NumberSizeableText
              formatter="marketCap"
              size="$bodyMdMedium"
              formatterOptions={{
                currency: '$',
              }}
            >
              {totalVolume}
            </NumberSizeableText>
          )}
        </SizableText>
      </Stack>
      <BuySellRatioBar
        buyPercentage={buyPercentage}
        isLoading={isLoading}
        noData={noData}
      />
      <Stack flexDirection="row" justifyContent="space-between">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_buy })} (
          {showBuyPlaceholder ? (
            '--'
          ) : (
            <NumberSizeableText
              formatter="marketCap"
              size="$bodyMd"
              color="$textSubdued"
              formatterOptions={{
                currency: '$',
              }}
            >
              {buyVolume}
            </NumberSizeableText>
          )}
          )
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_sell })} (
          {showSellPlaceholder ? (
            '--'
          ) : (
            <NumberSizeableText
              formatter="marketCap"
              size="$bodyMd"
              color="$textSubdued"
              formatterOptions={{
                currency: '$',
              }}
            >
              {sellVolume}
            </NumberSizeableText>
          )}
          )
        </SizableText>
      </Stack>
    </Stack>
  );
}
