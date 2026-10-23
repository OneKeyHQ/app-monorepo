import type { ComponentProps, PropsWithChildren } from 'react';

import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

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

export type IBrowserChromeCapsuleProps = PropsWithChildren<{
  flex?: number;
  height?: number;
  px?: IXStackProps['px'];
  // Liquid Glass only: dematerializes the glass (natively animated) while the
  // capsule is hidden, instead of fading an ancestor, which breaks glass.
  glassHidden?: boolean;
  // Animated style for the contents, e.g. their fade while the glass hides.
  contentStyle?: ComponentProps<typeof Animated.View>['style'];
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
  contentStyle,
}: IBrowserChromeCapsuleProps) {
  const isFloatingBrowserChrome = useIsFloatingBrowserChrome();
  const inner = (
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
  const content = contentStyle ? (
    <Animated.View style={contentStyle}>{inner}</Animated.View>
  ) : (
    inner
  );

  if (isLiquidGlassAvailable()) {
    return (
      <GlassView
        isInteractive
        glassEffectStyle={{
          style: glassHidden ? 'none' : 'regular',
          animate: true,
          animationDuration: 0.3,
        }}
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
