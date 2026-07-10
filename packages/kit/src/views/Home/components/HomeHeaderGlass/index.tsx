import { useAnimatedReaction } from 'react-native-reanimated';

import { useCurrentTabScrollY } from '@onekeyhq/components';
import {
  IMMERSIVE_GLASS_TOP_OFFSET,
  ImmersiveGlassOverlay,
} from '@onekeyhq/kit/src/components/ImmersiveGlassHeader';
import { HOME_HEADER_SEARCH_ROW_HEIGHT } from '@onekeyhq/kit/src/components/TabPageHeader/MDHeader';

import type { SharedValue } from 'react-native-reanimated';

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

// The Home (Wallet) instance of the shared immersive glass nav bar, sized to the
// Home search row. Fades in with `scrollY` (fed by HomeHeaderGlassScrollObserver
// above). The frost itself lives in the shared ImmersiveGlassOverlay so Home and
// the other immersive tab headers (Trade, ...) stay visually identical.
export function HomeHeaderGlassOverlay({
  scrollY,
}: {
  scrollY: SharedValue<number>;
}) {
  return (
    <ImmersiveGlassOverlay
      scrollY={scrollY}
      rowHeight={HOME_HEADER_SEARCH_ROW_HEIGHT}
      topOffset={IMMERSIVE_GLASS_TOP_OFFSET}
    />
  );
}
