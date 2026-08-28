import { useEffect, useMemo } from 'react';

import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import {
  getTokenValue,
  useTheme,
} from '@onekeyhq/components/src/shared/tamagui';
import type { Token } from '@onekeyhq/components/src/shared/tamagui';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Stack } from '../../primitives/Stack';

import type { IStackProps } from '../../primitives';

interface IConfirmHighlighter extends Partial<IStackProps> {
  highlight?: boolean;
  borderRadius?: IStackProps['borderRadius'];
}

const shadowOffset = {
  width: 0,
  height: 0,
};

const HIGHLIGHT_DURATION_MS = 1000;

export function ConfirmHighlighter({
  highlight,
  children,
  borderRadius,
  ...rest
}: IConfirmHighlighter) {
  const theme = useTheme();
  const highlightColor = theme.brand11.val;
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!highlight) {
      cancelAnimation(progress);
      progress.value = 0;
      return undefined;
    }
    progress.value = withRepeat(
      withTiming(1, {
        duration: HIGHLIGHT_DURATION_MS,
      }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(progress);
      progress.value = 0;
    };
  }, [highlight, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    borderWidth: progress.value * 2,
    opacity: progress.value,
    //  WARN  (ADVICE) View #10569 of type RCTView has a shadow set but cannot calculate shadow efficiently. Consider setting a background color to fix this, or apply the shadow to a more specific component.
    shadowOpacity: platformEnv.isNative
      ? undefined
      : 0.5 + progress.value * 0.5,
  }));

  const motiStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      left: -2,
      top: -2,
      right: -2,
      bottom: -2,
      borderRadius:
        typeof borderRadius !== 'number'
          ? getTokenValue(borderRadius as Token, 'size')
          : borderRadius,
      borderColor: highlightColor,
      shadowColor: highlightColor,
      shadowRadius: 10,
      shadowOpacity: platformEnv.isNative ? undefined : 1,
      shadowOffset,
    }),
    [borderRadius, highlightColor],
  );
  const highlighterStyle = useMemo(
    () => [motiStyle, animatedStyle],
    [animatedStyle, motiStyle],
  );

  return (
    <Stack borderRadius={borderRadius} {...rest}>
      {children}
      {highlight ? <Animated.View style={highlighterStyle} /> : null}
    </Stack>
  );
}
