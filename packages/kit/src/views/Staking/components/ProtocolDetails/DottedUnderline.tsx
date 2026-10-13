import { useCallback, useState } from 'react';

import Svg, { Line } from 'react-native-svg';

import { SizableText, Stack, YStack, useTheme } from '@onekeyhq/components';
import type { ISizableTextProps } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { LayoutChangeEvent } from 'react-native';

// A figure or label that opens an explanation is marked by a dotted rule
// rather than an icon — the affordance the design uses. Android's Text
// ignores textDecorationStyle, so the rule came out solid there (OK-62943):
// Android draws it as an SVG line under the text instead, while iOS and web
// keep the text decoration. $borderStrong so the dots read on a high-DPI
// screen (OK-62392).
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
  return (
    <YStack alignSelf="flex-start">
      <SizableText {...props} {...DOTTED_UNDERLINE_PROPS}>
        {children}
      </SizableText>
      {platformEnv.isNativeAndroid ? <DottedRule /> : null}
    </YStack>
  );
}
