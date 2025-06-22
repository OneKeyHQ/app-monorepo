import {
  NumberSizeableText,
  Progress,
  SizableText,
  Stack,
} from '@onekeyhq/components';

import type { IVolumeRowProps } from '../types';

export function VolumeRow({
  label,
  timeRange,
  buyVolume,
  sellVolume,
  totalVolume,
}: IVolumeRowProps) {
  const buyPercentage = totalVolume > 0 ? (buyVolume / totalVolume) * 100 : 0;

  return (
    <Stack gap="$2">
      <Stack flexDirection="row" alignItems="center" gap="$2">
        <SizableText size="$bodyLgMedium">
          {label} ({timeRange})
        </SizableText>
        <SizableText size="$bodyLgMedium">
          <NumberSizeableText
            formatter="marketCap"
            formatterOptions={{ currency: '$' }}
            size="$bodyLgMedium"
          >
            {totalVolume}
          </NumberSizeableText>
        </SizableText>
      </Stack>
      <Progress value={buyPercentage} progressColor="$bgSuccessStrong" />
      <Stack flexDirection="row" justifyContent="space-between">
        <SizableText size="$bodyMd" color="$textSubdued">
          Buy{' '}
          <NumberSizeableText
            formatter="marketCap"
            formatterOptions={{ currency: '$' }}
            size="$bodyMd"
            color="$textSubdued"
          >
            {buyVolume}
          </NumberSizeableText>
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          Sell{' '}
          <NumberSizeableText
            formatter="marketCap"
            formatterOptions={{ currency: '$' }}
            size="$bodyMd"
            color="$textSubdued"
          >
            {sellVolume}
          </NumberSizeableText>
        </SizableText>
      </Stack>
    </Stack>
  );
}
