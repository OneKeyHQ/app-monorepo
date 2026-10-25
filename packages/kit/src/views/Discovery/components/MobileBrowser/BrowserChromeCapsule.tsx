import { useMemo } from 'react';
import type { PropsWithChildren } from 'react';

import Animated, {
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';

import {
  GlassHeaderProvider,
  GlassView,
  Stack,
  XStack,
  isLiquidGlassAvailable,
} from '@onekeyhq/components';
import type { IXStackProps } from '@onekeyhq/components';

import { BROWSER_CHROME_CAPSULE_HEIGHT } from '../../config/Animation.constants';

import { useIsProgressPast } from './browserChrome';

import type { SharedValue } from 'react-native-reanimated';

export const PILL_RADIUS = 9999;

// How a capsule fades in over `range` of `progress` (or out, with `reverse`).
export interface ICapsuleFade {
  progress: SharedValue<number>;
  range: [number, number];
  reverse?: boolean;
}

// Where a capsule's fade is half done: its glass switches there.
function getCapsuleFadeMidpoint([start, end]: [number, number]) {
  return (start + end) / 2;
}

// Opacity of a capsule's contents along its fade. Callers that fade some
// children differently (the address capsule's domain) apply it per child.
export function useCapsuleFadeStyle(fade: ICapsuleFade | undefined) {
  const progress = fade?.progress;
  const [start, end] = fade?.range ?? [0, 0];
  const reverse = !!fade?.reverse;
  return useAnimatedStyle(() => {
    if (!progress) {
      return { opacity: 1 };
    }
    return {
      opacity: interpolate(
        progress.value,
        [start, end],
        reverse ? [1, 0] : [0, 1],
        'clamp',
      ),
    };
  }, [progress, start, end, reverse]);
}

const GLASS_FADE_SECONDS = 0.2;

type IBrowserChromeCapsuleProps = PropsWithChildren<{
  flex?: number;
  height?: number;
  px?: IXStackProps['px'];
  fade?: ICapsuleFade;
  // Off for contents laid over a background drawn elsewhere (the bar's
  // morphing address background); `fade` is ignored then.
  background?: boolean;
  // Defaults to a full pill; a chip hosting a square-ish item (the account
  // avatar) uses a concentric radius instead.
  borderRadius?: number;
  // Glass stays on through the fade (only the contents fade), for a caller
  // that hides the capsule another way (the header clips it). Switching the
  // glass back on replays iOS's materialize animation, whose shadow lands
  // before the glass and reads darker for a moment.
  keepGlass?: boolean;
}>;

// A pill (or circle, with a single child) hosting browser chrome buttons.
// iOS 26: Liquid Glass. Elsewhere: a solid filled pill (the bar sits on the
// page-colored strip below the WebView, so there's nothing to blur).
// GlassHeaderProvider makes inner IconButtons drop their own background and
// tertiary negative margin, so icons center inside the pill in both cases.
//
// A glass capsule is never faded with opacity: glass under an ancestor whose
// opacity animates to 0 stops rendering and can leave later glass broken
// (expo/expo#50097, #41024, #51575). Its glass fades natively instead (an
// animated glassEffectStyle switch at the middle of the fade, Expo's
// recommended way) and its contents fade on their own.
export function BrowserChromeCapsule({
  children,
  flex,
  height = BROWSER_CHROME_CAPSULE_HEIGHT,
  px = '$1',
  fade,
  background = true,
  borderRadius = PILL_RADIUS,
  keepGlass,
}: IBrowserChromeCapsuleProps) {
  const isGlass = isLiquidGlassAvailable();
  const fadeStyle = useCapsuleFadeStyle(fade);
  const glassHidden = useIsProgressPast(
    // Only glass needs the switch; without it no JS update at the midpoint.
    isGlass && !keepGlass ? fade?.progress : undefined,
    fade ? getCapsuleFadeMidpoint(fade.range) : 0,
    fade?.reverse ? 'above' : 'below',
  );
  const glassEffectStyle = useMemo(
    () => ({
      style: glassHidden ? ('none' as const) : ('regular' as const),
      animate: true,
      animationDuration: GLASS_FADE_SECONDS,
    }),
    [glassHidden],
  );
  const row = (
    <XStack
      h={height}
      minWidth={height}
      px={px}
      gap="$1"
      alignItems="center"
      justifyContent="center"
    >
      {children}
    </XStack>
  );
  if (!background) {
    return (
      <Stack flex={flex}>
        <GlassHeaderProvider>{row}</GlassHeaderProvider>
      </Stack>
    );
  }
  if (isGlass) {
    return (
      <GlassView
        isInteractive
        glassEffectStyle={glassEffectStyle}
        style={{ borderRadius, flex }}
      >
        <GlassHeaderProvider>
          {fade ? <Animated.View style={fadeStyle}>{row}</Animated.View> : row}
        </GlassHeaderProvider>
      </GlassView>
    );
  }
  // No glass here, so the solid pill simply fades as a whole. A column
  // container like GlassView, so the inner row stretches to the capsule's
  // width (as a row child it would shrink to its content, leaving the
  // flexible address area no room).
  return (
    <Animated.View style={[{ flex }, fadeStyle]}>
      <Stack
        flex={flex}
        bg="$bgStrong"
        borderRadius={borderRadius}
        borderCurve="continuous"
      >
        <GlassHeaderProvider>{row}</GlassHeaderProvider>
      </Stack>
    </Animated.View>
  );
}
