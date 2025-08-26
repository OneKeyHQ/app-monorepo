import { useIntl } from 'react-intl';

import { NumberSizeableText, SizableText, Stack } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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
  const buyPercentage = totalVolume > 0 ? (buyVolume / totalVolume) * 100 : 0;
  const [settingsPersistAtom] = useSettingsPersistAtom();
  return (
    <Stack gap="$2">
      <Stack flexDirection="row" alignItems="center" gap="$2">
        <SizableText size="$bodyMdMedium">
          {label}:{' '}
          {isLoading ? (
            '--'
          ) : (
            <NumberSizeableText
              formatter="marketCap"
              size="$bodyMdMedium"
              formatterOptions={{
                currency: settingsPersistAtom.currencyInfo.symbol,
              }}
            >
              {totalVolume}
            </NumberSizeableText>
          )}
        </SizableText>
      </Stack>
      <BuySellRatioBar buyPercentage={buyPercentage} isLoading={isLoading} />
      <Stack flexDirection="row" justifyContent="space-between">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_buy })} (
          {isLoading ? (
            '--'
          ) : (
            <NumberSizeableText
              formatter="marketCap"
              size="$bodyMd"
              color="$textSubdued"
              formatterOptions={{
                currency: settingsPersistAtom.currencyInfo.symbol,
              }}
            >
              {buyVolume}
            </NumberSizeableText>
          )}
          )
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_sell })} (
          {isLoading ? (
            '--'
          ) : (
            <NumberSizeableText
              formatter="marketCap"
              size="$bodyMd"
              color="$textSubdued"
              formatterOptions={{
                currency: settingsPersistAtom.currencyInfo.symbol,
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
