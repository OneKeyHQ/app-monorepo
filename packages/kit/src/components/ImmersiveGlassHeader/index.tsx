import { useMemo } from 'react';

import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';

import { ProgressiveBlur, useSafeAreaInsets } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import type { SharedValue } from 'react-native-reanimated';

// Single source of truth for the immersive Liquid-Glass header effect (the
// translucent progressive-blur nav bar that page content scrolls under). Both
// the Home (Wallet) and Trade (Swap) tab headers gate on this, so restricting
// the effect later — e.g. to iOS 26+ via a JS hot-update — is a one-line change
// here (`platformEnv.isNativeIOS` -> `platformEnv.isNativeIOS26Plus`) that flips
// every page at once instead of drifting per-page.
export const ENABLE_IMMERSIVE_GLASS_HEADER = platformEnv.isNativeIOS;

// Height of the single fixed header row that stays put while content scrolls
// under it (Home search row / Swap tab-switch row). Both were deliberately set
// to 56 so the two tab headers align; the glass frost sizes itself to this.
export const IMMERSIVE_HEADER_ROW_HEIGHT = 56;

// Distance (px) over which the glass ramps 0 -> 1 as content scrolls under the
// bar: transparent at rest (blends seamlessly with the page), frosting only once
// content actually slides beneath it.
const GLASS_FADE_DISTANCE = 16;
// Default px the frost layer extends BELOW the header row, into the content
// area, so the progressive-blur gradient falloff plays out over a taller band
// (softer, more native transition) instead of ending right at the row. Pages
// with a pinned row directly under the bar (e.g. Swap Pro's sticky token
// selector) pass overhang={0} so the frost doesn't blur that pinned row.
export const IMMERSIVE_GLASS_OVERHANG = 80;
// Compensation (px) Home passes so the frost still reaches the true top edge:
// Home's fixed bar sits at top={-IMMERSIVE_GLASS_TOP_OFFSET}. Pages that anchor
// the overlay at the real top edge use the default topOffset={0}.
export const IMMERSIVE_GLASS_TOP_OFFSET = 20;

// Tab routes whose immersive glass header owns the top region: MDHeader drops
// its status-bar spacer for these so the page can scroll content under the bar.
// Add a route here (rather than another `|| tabRoute === X` inside MDHeader)
// when giving a non-Home tab the immersive treatment. Home renders on its own
// header path and does not go through that spacer branch.
export const IMMERSIVE_GLASS_HEADER_TAB_ROUTES = new Set<ETabRoutes>([
  ETabRoutes.Swap,
]);

// The translucent Liquid-Glass frost behind a fixed immersive nav bar. Fades in
// with `scrollY` (fed by the host page's scroll observer) and progressively
// blurs via ProgressiveBlur. Rendered only on iOS, so its reanimated /
// safe-area hooks never run on other platforms.
//
// - scrollY:   the focused scroll offset that drives the fade.
// - rowHeight: the fixed header row height the frost sizes itself to.
// - topOffset: px to add so the frost still reaches the screen's top edge when
//              the host bar is shifted upward (Home passes
//              IMMERSIVE_GLASS_TOP_OFFSET; anchored-at-top pages keep the 0
//              default).
// - overhang:  px the frost extends below the row into scrolling content; pass 0
//              when a pinned row sits directly under the bar.
export function ImmersiveGlassOverlay({
  scrollY,
  rowHeight = IMMERSIVE_HEADER_ROW_HEIGHT,
  topOffset = 0,
  overhang = IMMERSIVE_GLASS_OVERHANG,
}: {
  scrollY: SharedValue<number>;
  rowHeight?: number;
  topOffset?: number;
  overhang?: number;
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
  // Explicit geometry so the frost spans safe-area-top + the header row + the
  // overhang band (relying on the overlay's own margin/padding came up short).
  const layerStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      height: top + rowHeight + topOffset + overhang,
    }),
    [top, rowHeight, topOffset, overhang],
  );

  return (
    <Animated.View pointerEvents="none" style={[layerStyle, glassStyle]}>
      <ProgressiveBlur />
    </Animated.View>
  );
}
