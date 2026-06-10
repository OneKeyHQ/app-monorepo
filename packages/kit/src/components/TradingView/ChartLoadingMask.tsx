import { LottieView, Stack } from '@onekeyhq/components';
import TradingViewChartLoadingAnimation from '@onekeyhq/kit/assets/animations/swap_order_pending.json';

// Shared chart loading mask (Lottie) used by both the perps and market charts.
// Shown while the chart is still loading, so the user never sees the blank /
// flat-candle chart mid-load. Cleared when the chart engine resolves getBars for
// the symbol (the unified `tradingview_barsState` signal — data present OR
// confirmed empty), or by a timeout fallback for paths that never emit it.
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
