import { LottieView, Stack } from '@onekeyhq/components';
import TradingViewChartLoadingAnimation from '@onekeyhq/kit/assets/animations/swap_order_pending.json';

export function TradingViewChartLoadingMask({ testID }: { testID?: string }) {
  return (
    <Stack
      position="absolute"
      top={0}
      right={0}
      bottom={0}
      left={0}
      zIndex={2}
      bg="$bgApp"
      alignItems="center"
      justifyContent="center"
      pointerEvents="none"
      testID={testID}
    >
      <LottieView
        width={110}
        height={110}
        autoPlay
        source={TradingViewChartLoadingAnimation}
      />
    </Stack>
  );
}
