import { Progress, SizableText, Stack } from '@onekeyhq/components';

type IActivityRowProps = {
  label: string;
  buyValue: string;
  sellValue: string;
  buyPercentage: number; // 0 to 100
};

export function ActivityRow({
  label,
  buyValue,
  sellValue,
  buyPercentage,
}: IActivityRowProps) {
  return (
    <Stack space="$2">
      <SizableText size="$bodyLgMedium">{label}</SizableText>
      <Progress value={buyPercentage} progressColor="$bgSuccessStrong" />
      <Stack flexDirection="row" justifyContent="space-between">
        <SizableText size="$bodyMd" color="$textSubdued">
          {buyValue}
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          {sellValue}
        </SizableText>
      </Stack>
    </Stack>
  );
}
