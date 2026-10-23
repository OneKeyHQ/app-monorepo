import type { PropsWithChildren } from 'react';

import { StyleSheet } from 'react-native';

import {
  BlurView,
  GlassHeaderProvider,
  GlassView,
  XStack,
  isLiquidGlassAvailable,
} from '@onekeyhq/components';
import type { IXStackProps } from '@onekeyhq/components';

import { BROWSER_CHROME_CAPSULE_HEIGHT } from '../../config/Animation.constants';

import { useIsFloatingBrowserChrome } from './browserChrome';

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
// iOS 26: Liquid Glass. Older iOS: frosted blur, since the bar floats over
// the page there. Android (bar never floats): a solid filled pill.
// GlassHeaderProvider makes inner IconButtons drop their own background and
// tertiary negative margin, so icons center inside the pill in both cases.
export function BrowserChromeCapsule({
  children,
  flex,
  height = BROWSER_CHROME_CAPSULE_HEIGHT,
  px = '$1',
  glassHidden = false,
}: IBrowserChromeCapsuleProps) {
  const isFloatingBrowserChrome = useIsFloatingBrowserChrome();
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
  if (isFloatingBrowserChrome) {
    return (
      <XStack
        flex={flex}
        borderRadius="$full"
        borderCurve="continuous"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        overflow="hidden"
      >
        <BlurView
          position="absolute"
          top={0}
          right={0}
          bottom={0}
          left={0}
          intensity={80}
          borderRadius="$full"
        />
        {content}
      </XStack>
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
