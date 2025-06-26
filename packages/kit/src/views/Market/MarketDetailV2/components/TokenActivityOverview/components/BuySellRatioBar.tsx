import { Stack, View } from '@onekeyhq/components';

interface IBuySellRatioBarProps {
  buyPercentage: number;
}

export function BuySellRatioBar({ buyPercentage }: IBuySellRatioBarProps) {
  const sellPercentage = 100 - buyPercentage;

  return (
    <Stack
      flexDirection="row"
      height="$2"
      borderRadius="$2"
      overflow="hidden"
      gap="$1"
    >
      <View flex={buyPercentage} backgroundColor="$bgSuccessStrong" />
      <View flex={sellPercentage} backgroundColor="$bgCriticalStrong" />
    </Stack>
  );
}
