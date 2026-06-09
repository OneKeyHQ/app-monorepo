import { LottieView, Stack } from '@onekeyhq/components';
import TradingViewChartLoadingAnimation from '@onekeyhq/kit/assets/animations/swap_order_pending.json';

// Shared chart loading mask (Lottie) used by both the perps and market charts.
// Shown until real (non-empty) kline bars arrive, so the user never sees the
// blank / flat-candle chart while data is loading or missing. Driven by the
// unified `tradingview_barsState` signal from the chart library.
export function ChartLoadingMask({ visible }: { visible: boolean }) {
  if (!visible) {
    return null;
  }
  return (
    <Stack
      position="absolute"
      left={0}
      top={0}
      right={0}
      bottom={0}
      zIndex={2}
      bg="$bgApp"
      alignItems="center"
      justifyContent="center"
      pointerEvents="none"
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

export default ChartLoadingMask;
