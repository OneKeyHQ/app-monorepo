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
}: IVolumeRowProps) {
  const intl = useIntl();
  const buyPercentage = totalVolume > 0 ? (buyVolume / totalVolume) * 100 : 0;

  return (
    <Stack gap="$2">
      <Stack flexDirection="row" alignItems="center" gap="$2">
        <SizableText size="$bodyLgMedium">
          {label}:{' '}
          <NumberSizeableText
            formatter="marketCap"
            formatterOptions={{ currency: '$' }}
            size="$bodyLgMedium"
          >
            {totalVolume}
          </NumberSizeableText>
        </SizableText>
      </Stack>
      <BuySellRatioBar buyPercentage={buyPercentage} />
      <Stack flexDirection="row" justifyContent="space-between">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_buy })} (
          <NumberSizeableText
            formatter="marketCap"
            formatterOptions={{ currency: '$' }}
            size="$bodyMd"
            color="$textSubdued"
          >
            {buyVolume}
          </NumberSizeableText>
          )
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_sell })} (
          <NumberSizeableText
            formatter="marketCap"
            formatterOptions={{ currency: '$' }}
            size="$bodyMd"
            color="$textSubdued"
          >
            {sellVolume}
          </NumberSizeableText>
          )
        </SizableText>
      </Stack>
    </Stack>
  );
}
