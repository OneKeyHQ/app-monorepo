import type { PropsWithChildren } from 'react';

import { StyleSheet } from 'react-native';

import {
  GlassHeaderProvider,
  GlassView,
  XStack,
  isLiquidGlassAvailable,
} from '@onekeyhq/components';
import type { IXStackProps } from '@onekeyhq/components';

import { BROWSER_CHROME_CAPSULE_HEIGHT } from '../../config/Animation.constants';

const styles = StyleSheet.create({
  glass: { borderRadius: 9999 },
});

type IBrowserChromeCapsuleProps = PropsWithChildren<{
  flex?: number;
  height?: number;
  px?: IXStackProps['px'];
  // Liquid Glass only: turn the glass off while the capsule is faded out.
  // Glass under an ancestor at opacity 0 stops rendering and doesn't come
  // back, so callers fading the capsule switch it off just before 0 (the
  // approach Expo documents for fading glass).
  glassHidden?: boolean;
}>;

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
  glassHidden = false,
}: IBrowserChromeCapsuleProps) {
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
  return (
    <XStack
      flex={flex}
      bg="$bgStrong"
      borderRadius="$full"
      borderCurve="continuous"
    >
      {content}
    </XStack>
  );
}
