import type { PropsWithChildren } from 'react';

import {
  GlassHeaderProvider,
  GlassView,
  XStack,
  isLiquidGlassAvailable,
} from '@onekeyhq/components';
import type { IXStackProps } from '@onekeyhq/components';

import { BROWSER_CHROME_CAPSULE_HEIGHT } from '../../config/Animation.constants';

type IBrowserChromeCapsuleProps = PropsWithChildren<{
  flex?: number;
  height?: number;
  px?: IXStackProps['px'];
  testID?: string;
}>;

// A pill (or circle, with a single child) hosting browser chrome buttons.
// iOS 26: Liquid Glass. Elsewhere: a solid filled pill with the same metrics.
// GlassHeaderProvider makes inner IconButtons drop their own background and
// tertiary negative margin, so icons center inside the pill in both cases.
export function BrowserChromeCapsule({
  children,
  flex,
  height = BROWSER_CHROME_CAPSULE_HEIGHT,
  px = '$1',
  testID,
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
        testID={testID}
      >
        {children}
      </XStack>
    </GlassHeaderProvider>
  );

  if (isLiquidGlassAvailable()) {
    return (
      <GlassView
        isInteractive
        glassEffectStyle="regular"
        style={{ borderRadius: 9999, flex }}
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
