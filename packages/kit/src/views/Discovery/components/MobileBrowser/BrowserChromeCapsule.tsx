import { useMemo } from 'react';
import type { PropsWithChildren } from 'react';

import { StyleSheet } from 'react-native';
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
  useTheme,
  useThemeName,
} from '@onekeyhq/components';
import type { IXStackProps } from '@onekeyhq/components';

import { BROWSER_CHROME_CAPSULE_HEIGHT } from '../../config/Animation.constants';

import { useIsProgressPast } from './browserChrome';

import type { SharedValue } from 'react-native-reanimated';

export const PILL_RADIUS = 9999;

const styles = StyleSheet.create({
  solidBackground: StyleSheet.absoluteFillObject,
});

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
  // morphing address background).
  background?: boolean;
  // Defaults to a full pill; a chip hosting a square-ish item (the account
  // avatar) uses a concentric radius instead.
  borderRadius?: number;
}>;

// A pill (or circle, with a single child) hosting browser chrome buttons.
// iOS 26: Liquid Glass. Elsewhere: a solid filled pill (the bar sits on the
// page-colored strip below the WebView, so there's nothing to blur).
// GlassHeaderProvider makes inner IconButtons drop their own background and
// tertiary negative margin, so icons center inside the pill in both cases.
//
// The capsule itself is never faded with opacity: glass under an ancestor
// whose opacity animates to 0 stops rendering and can leave later glass
// broken (expo/expo#50097, #41024, #51575). Its glass fades natively instead
// (an animated glassEffectStyle switch at the middle of the fade, Expo's
// recommended way), the solid pill fades only its background, and the
// contents fade on their own.
export function BrowserChromeCapsule({
  children,
  flex,
  height = BROWSER_CHROME_CAPSULE_HEIGHT,
  px = '$1',
  fade,
  background = true,
  borderRadius = PILL_RADIUS,
}: IBrowserChromeCapsuleProps) {
  const isGlass = isLiquidGlassAvailable();
  const theme = useTheme();
  // Re-render on a light/dark switch (the page's theme): `theme.*.val` reads
  // alone don't subscribe on native.
  useThemeName();
  const fadeStyle = useCapsuleFadeStyle(fade);
  const glassHidden = useIsProgressPast(
    // Only glass needs the switch; without it no JS update at the midpoint.
    isGlass ? fade?.progress : undefined,
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
  const content = (
    <GlassHeaderProvider>
      {fade ? <Animated.View style={fadeStyle}>{row}</Animated.View> : row}
    </GlassHeaderProvider>
  );

  if (!background) {
    return <Stack flex={flex}>{content}</Stack>;
  }
  if (isGlass) {
    return (
      <GlassView
        isInteractive
        glassEffectStyle={glassEffectStyle}
        style={{ borderRadius, flex }}
      >
        {content}
      </GlassView>
    );
  }
  // A column container like GlassView, so the inner row stretches to the
  // capsule's width (as a row child it would shrink to its content, leaving
  // the flexible address area no room).
  // The fill sits on the fading layer itself (non-collapsible): a bare
  // animated wrapper around a filled child can be flattened away on Android,
  // taking the fill with it.
  return (
    <Stack flex={flex} borderRadius={borderRadius} borderCurve="continuous">
      <Animated.View
        collapsable={false}
        pointerEvents="none"
        style={[
          styles.solidBackground,
          { borderRadius, backgroundColor: theme.bgStrong.val },
          fadeStyle,
        ]}
      />
      {content}
    </Stack>
  );
}
