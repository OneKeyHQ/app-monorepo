import type { PropsWithChildren } from 'react';

import { StyleSheet } from 'react-native';
import { useAnimatedProps } from 'react-native-reanimated';

import {
  AnimatedGlassView,
  GlassHeaderProvider,
  Stack,
  XStack,
  isLiquidGlassAvailable,
} from '@onekeyhq/components';
import type { IXStackProps } from '@onekeyhq/components';

import { BROWSER_CHROME_CAPSULE_HEIGHT } from '../../config/Animation.constants';

import type { SharedValue } from 'react-native-reanimated';

const styles = StyleSheet.create({
  glass: { borderRadius: 9999 },
});

type IBrowserChromeCapsuleProps = PropsWithChildren<{
  flex?: number;
  height?: number;
  px?: IXStackProps['px'];
  // Liquid Glass only: the fade the caller applies to this capsule.
  glassFade?: IGlassFade;
}>;

// Where a caller's opacity fade on the capsule reaches 0: below `edge` or
// above it, on `progress`. Glass that fades to opacity 0 under its parent
// stops rendering, and can leave later glass under that parent broken too
// (expo/expo#50097, #41024), so the glass is switched off just before the
// fade hits 0 (Expo's documented workaround). The switch runs on the UI
// thread with the fade itself: a JS state round trip can land after a fast
// reversal has already taken the opacity to 0.
export interface IGlassFade {
  progress: SharedValue<number>;
  edge: number;
  direction: 'below' | 'above';
}

const GLASS_OFF_MARGIN = 0.02;

// A pill (or circle, with a single child) hosting browser chrome buttons.
// iOS 26: Liquid Glass. Elsewhere: a solid filled pill (the bar sits on the
// page-colored strip below the WebView, so there's nothing to blur).
// GlassHeaderProvider makes inner IconButtons drop their own background and
// tertiary negative margin, so icons center inside the pill in both cases.
export function BrowserChromeCapsule({
  children,
  flex,
  height = BROWSER_CHROME_CAPSULE_HEIGHT,
  px = '$1',
  glassFade,
}: IBrowserChromeCapsuleProps) {
  const fadeProgress = glassFade?.progress;
  const fadeEdge = glassFade?.edge ?? 0;
  const fadeAbove = glassFade?.direction === 'above';
  const glassAnimatedProps = useAnimatedProps(() => {
    let hidden = false;
    if (fadeProgress) {
      hidden = fadeAbove
        ? fadeProgress.value > fadeEdge - GLASS_OFF_MARGIN
        : fadeProgress.value < fadeEdge + GLASS_OFF_MARGIN;
    }
    return {
      glassEffectStyle: hidden ? ('none' as const) : ('regular' as const),
    };
  }, [fadeProgress, fadeEdge, fadeAbove]);
  const content = (
    <GlassHeaderProvider>
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
    </GlassHeaderProvider>
  );

  if (isLiquidGlassAvailable()) {
    return (
      <AnimatedGlassView
        isInteractive
        animatedProps={glassAnimatedProps}
        style={flex ? [styles.glass, { flex }] : styles.glass}
      >
        {content}
      </AnimatedGlassView>
    );
  }
  // A column container like GlassView, so the inner row stretches to the
  // capsule's width (as a row child it would shrink to its content, leaving
  // the flexible address area no room).
  return (
    <Stack
      flex={flex}
      bg="$bgStrong"
      borderRadius="$full"
      borderCurve="continuous"
    >
      {content}
    </Stack>
  );
}
