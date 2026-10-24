import type { PropsWithChildren } from 'react';

import { StyleSheet } from 'react-native';

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
// above it, on `progress`. Glass under an ancestor at opacity 0 stops
// rendering and doesn't come back, so the glass is switched off just before
// the fade hits 0 (the approach Expo documents for fading glass). Kept inside
// the capsule so crossing the edge re-renders only this capsule.
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
  const glassHidden = useIsProgressPast(
    glassFade?.progress,
    glassFade?.direction === 'above'
      ? (glassFade?.edge ?? 0) - GLASS_OFF_MARGIN
      : (glassFade?.edge ?? 0) + GLASS_OFF_MARGIN,
    glassFade?.direction,
  );
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
      <GlassView
        isInteractive
        glassEffectStyle={glassHidden ? 'none' : 'regular'}
        style={flex ? [styles.glass, { flex }] : styles.glass}
      >
        {content}
      </GlassView>
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
