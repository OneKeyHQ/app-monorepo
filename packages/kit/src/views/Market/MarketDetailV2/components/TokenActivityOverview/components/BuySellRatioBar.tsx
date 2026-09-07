import { Stack, View } from '@onekeyhq/components';
import type { IStackProps } from '@onekeyhq/components';

interface IBuySellRatioBarProps {
  buyPercentage: number;
  isLoading?: boolean;
  noData?: boolean;
  height?: IStackProps['height'];
}

export function BuySellRatioBar({
  buyPercentage,
  isLoading,
  noData,
  height = '$2',
}: IBuySellRatioBarProps) {
  const sellPercentage = 100 - buyPercentage;

  if (isLoading || noData) {
    return (
      <Stack
        flexDirection="row"
        height={height}
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
      height={height}
      borderRadius="$2"
      overflow="hidden"
      gap="$1"
    >
      <View flex={buyPercentage} backgroundColor="$bgSuccessStrong" />
      <View flex={sellPercentage} backgroundColor="$bgCriticalStrong" />
    </Stack>
  );
}
