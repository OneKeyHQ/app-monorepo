import { Skeleton, Stack } from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY } from '@onekeyhq/components/src/utils/animationConstants';

import { MarketTestIDs } from '../../../testIDs';

export function MarketTradingViewLoading({
  minHeight,
  overlay = false,
}: {
  minHeight?: number;
  overlay?: boolean;
}) {
  return (
    <Stack
      testID={MarketTestIDs.detailChartLoading}
      position={overlay ? 'absolute' : 'relative'}
      top={overlay ? 0 : undefined}
      right={overlay ? 0 : undefined}
      bottom={overlay ? 0 : undefined}
      left={overlay ? 0 : undefined}
      minHeight={minHeight}
      flex={1}
      bg="$bgApp"
      pointerEvents="none"
      overflow="hidden"
      animation={overlay ? 'quick' : undefined}
      animateOnly={overlay ? ANIMATE_ONLY_OPACITY : undefined}
      enterStyle={overlay ? { opacity: 0 } : undefined}
      exitStyle={overlay ? { opacity: 0 } : undefined}
    >
      {[18, 36, 54, 72, 90].map((top) => (
        <Stack
          key={`horizontal-${top}`}
          position="absolute"
          top={`${top}%`}
          left={0}
          right={0}
          borderTopWidth={1}
          borderColor="$borderSubdued"
          opacity={0.45}
        />
      ))}
      {[20, 40, 60, 80].map((left) => (
        <Stack
          key={`vertical-${left}`}
          position="absolute"
          left={`${left}%`}
          top={0}
          bottom={0}
          borderLeftWidth={1}
          borderColor="$borderSubdued"
          opacity={0.35}
        />
      ))}
      <Stack position="absolute" top="$4" left="$4" gap="$2">
        <Skeleton width="$24" height="$4" />
        <Skeleton width="$16" height="$3" />
      </Stack>
    </Stack>
  );
}
