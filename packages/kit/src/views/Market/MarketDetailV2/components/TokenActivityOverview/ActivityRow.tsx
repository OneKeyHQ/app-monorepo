import {
  NumberSizeableText,
  Progress,
  SizableText,
  Stack,
} from '@onekeyhq/components';

type IActivityRowProps = {
  label: string;
  buyValue: string;
  sellValue: string;
  buyPercentage: number; // 0 to 100
  // Optional volume data for formatted display
  totalVolume?: number;
  buyVolume?: number;
  sellVolume?: number;
};

export function ActivityRow({
  label,
  buyValue,
  sellValue,
  buyPercentage,
  totalVolume,
  buyVolume,
  sellVolume,
}: IActivityRowProps) {
  return (
    <Stack gap="$2">
      <Stack flexDirection="row" alignItems="center" gap="$2">
        <SizableText size="$bodyLgMedium">{label}</SizableText>
        {totalVolume !== undefined ? (
          <SizableText size="$bodyLgMedium">
            <NumberSizeableText
              formatter="marketCap"
              formatterOptions={{ currency: '$' }}
              size="$bodyLgMedium"
            >
              {totalVolume}
            </NumberSizeableText>
          </SizableText>
        ) : null}
      </Stack>
      <Progress value={buyPercentage} progressColor="$bgSuccessStrong" />
      <Stack flexDirection="row" justifyContent="space-between">
        <SizableText size="$bodyMd" color="$textSubdued">
          {buyValue}
          {buyVolume !== undefined ? (
            <NumberSizeableText
              formatter="marketCap"
              formatterOptions={{ currency: '$' }}
              size="$bodyMd"
              color="$textSubdued"
            >
              {buyVolume}
            </NumberSizeableText>
          ) : null}
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          {sellValue}
          {sellVolume !== undefined ? (
            <NumberSizeableText
              formatter="marketCap"
              formatterOptions={{ currency: '$' }}
              size="$bodyMd"
              color="$textSubdued"
            >
              {sellVolume}
            </NumberSizeableText>
          ) : null}
        </SizableText>
      </Stack>
    </Stack>
  );
}
