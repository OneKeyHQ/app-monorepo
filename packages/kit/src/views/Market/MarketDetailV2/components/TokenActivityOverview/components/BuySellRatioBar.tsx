import { Stack, View } from '@onekeyhq/components';

interface IBuySellRatioBarProps {
  buyPercentage: number;
  isLoading?: boolean;
  noData?: boolean;
}

export function BuySellRatioBar({
  buyPercentage,
  isLoading,
  noData,
}: IBuySellRatioBarProps) {
  const sellPercentage = 100 - buyPercentage;

  if (isLoading || noData) {
    return (
      <Stack
        flexDirection="row"
        height="$2"
        borderRadius="$2"
        overflow="hidden"
      >
        <View flex={1} backgroundColor="$neutral5" />
      </Stack>
    );
  }

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
