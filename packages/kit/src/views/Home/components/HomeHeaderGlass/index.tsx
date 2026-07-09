import { useMemo } from 'react';

import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
} from 'react-native-reanimated';

import {
  ProgressiveBlur,
  useCurrentTabScrollY,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { HOME_HEADER_SEARCH_ROW_HEIGHT } from '@onekeyhq/kit/src/components/TabPageHeader/MDHeader';

import type { SharedValue } from 'react-native-reanimated';

// Distance (px) over which the glass ramps 0 -> 1 as content scrolls under the
// bar: transparent at rest (blends seamlessly with the page), frosting only once
// content actually slides beneath it.
const GLASS_FADE_DISTANCE = 16;
// Extra px the frost layer extends BELOW the search row, into the content area,
// so the progressive-blur gradient falloff plays out over a taller band (softer,
// more native transition) instead of ending right at the search row.
const GLASS_OVERHANG = 80;
// Cancels the fixed overlay's own `top={-20}` so the frost still reaches the
// very top edge of the screen.
const OVERLAY_TOP_OFFSET = 20;

// Bridges the focused tab's scroll offset out to the fixed glass overlay (which
// lives OUTSIDE Tabs.Container and so cannot call useCurrentTabScrollY itself).
// Calls useCurrentTabScrollY, so it MUST only be mounted inside a Tabs.Container
// subtree (rendered from HomePageView's renderHeader, gated on headerProps).
// Same constraint/pattern as FrozenTopHistoryScrollObserver.
export function HomeHeaderGlassScrollObserver({
  scrollYOut,
}: {
  scrollYOut: SharedValue<number>;
}) {
  const scrollY = useCurrentTabScrollY();
  useAnimatedReaction(
    () => (scrollY as SharedValue<number>).value,
    (y) => {
      'worklet';

      scrollYOut.value = y;
    },
  );
  return null;
}

// The translucent Liquid-Glass frost behind the fixed iOS Home nav bar. Fades in
// with `scrollY` (fed by HomeHeaderGlassScrollObserver) and progressively blurs
// via ProgressiveBlur. Rendered only on iOS, so its reanimated / safe-area hooks
// never run on other platforms.
export function HomeHeaderGlassOverlay({
  scrollY,
}: {
  scrollY: SharedValue<number>;
}) {
  const { top } = useSafeAreaInsets();
  const glassStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [0, GLASS_FADE_DISTANCE],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));
  // Explicit geometry so the frost spans safe-area-top + the search row + the
  // overhang band (relying on the overlay's own margin/padding came up short).
  const layerStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      height:
        top +
        HOME_HEADER_SEARCH_ROW_HEIGHT +
        OVERLAY_TOP_OFFSET +
        GLASS_OVERHANG,
    }),
    [top],
  );
  const style = useMemo(
    () => [layerStyle, glassStyle],
    [layerStyle, glassStyle],
  );

  return (
    <Animated.View pointerEvents="none" style={style}>
      <ProgressiveBlur />
    </Animated.View>
  );
}
