import { memo, useEffect } from 'react';

import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { SizableText, Stack } from '@onekeyhq/components';
import type { ISizableTextProps } from '@onekeyhq/components';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

// Shared with the Swap received-total animation. Each column rolls independently.
export const RollingDigit = memo(function RollingDigit({
  digit,
  color,
  lineHeight,
  textProps,
  animateOnMount = true,
  duration = 900,
}: {
  digit: number;
  color?: ISizableTextProps['color'];
  lineHeight: number;
  textProps: ISizableTextProps;
  animateOnMount?: boolean;
  duration?: number;
}) {
  const reducedMotion = useReducedMotion();
  const offset = useSharedValue(animateOnMount ? 0 : -digit * lineHeight);
  useEffect(() => {
    const target = -digit * lineHeight;
    offset.value = reducedMotion
      ? target
      : withTiming(target, { duration, easing: Easing.out(Easing.cubic) });
    return () => cancelAnimation(offset);
  }, [digit, duration, lineHeight, offset, reducedMotion]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
  }));
  return (
    <Stack height={lineHeight} overflow="hidden" flexShrink={0}>
      <Animated.View style={style}>
        {DIGITS.map((item) => (
          <SizableText
            key={item}
            {...textProps}
            height={lineHeight}
            lineHeight={lineHeight}
            color={color}
            textAlign="center"
          >
            {item}
          </SizableText>
        ))}
      </Animated.View>
    </Stack>
  );
});
