import { useCallback, useState } from 'react';

import Svg, { Line } from 'react-native-svg';

import {
  DashText,
  SizableText,
  Stack,
  YStack,
  useTheme,
} from '@onekeyhq/components';
import type { ISizableTextProps } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { LayoutChangeEvent } from 'react-native';

// A figure or label that opens an explanation is marked by a dotted rule
// rather than an icon — the affordance the design uses. Android's Text
// ignores textDecorationStyle, so the rule came out solid there (OK-62943):
// Android draws the dots itself instead (DottedRule under the headline APY,
// DashText under a label), while iOS and web keep the text decoration.
// $borderStrong so the dots read on a high-DPI screen (OK-62392).
export const DOTTED_UNDERLINE_PROPS = platformEnv.isNativeAndroid
  ? {}
  : ({
      textDecorationLine: 'underline',
      textDecorationStyle: 'dotted',
      textDecorationColor: '$borderStrong',
    } as const);

/** The dotted rule Android draws under a text, as wide as its container. */
export function DottedRule() {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width),
    [],
  );
  return (
    <Stack w="100%" h={3} onLayout={handleLayout}>
      {width > 0 ? (
        <Svg width={width} height={3}>
          <Line
            x1={1}
            y1={1.5}
            x2={width - 1}
            y2={1.5}
            stroke={theme.borderStrong.val}
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray="0.1 4"
          />
        </Svg>
      ) : null}
    </Stack>
  );
}

/** A text marked with the dotted rule on every platform, for a tooltip trigger. */
export function DottedUnderlineText({ children, ...props }: ISizableTextProps) {
  if (platformEnv.isNativeAndroid) {
    // Inside a popover trigger (the detail page's Investment cells, the
    // card's effective deposit) DottedRule's percentage width had nothing to
    // resolve against, so Android drew no rule at all. DashText measures the
    // text itself and draws the dots as views, the way the borrow APY
    // triggers already do on Android.
    return (
      <YStack alignSelf="flex-start">
        <DashText
          {...props}
          dashColor="$borderStrong"
          dashLength={2}
          dashGap={2}
          dashThickness={1}
        >
          {children}
        </DashText>
      </YStack>
    );
  }
  return (
    <YStack alignSelf="flex-start">
      <SizableText {...props} {...DOTTED_UNDERLINE_PROPS}>
        {children}
      </SizableText>
    </YStack>
  );
}
