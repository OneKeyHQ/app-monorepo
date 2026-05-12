import { memo, useCallback, useEffect, useState } from 'react';

import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { SizableText, XStack } from '@onekeyhq/components';

import { INVITE_CODE_COLUMN_CODE_CHAR_WIDTH } from '../const';

import type { LayoutChangeEvent } from 'react-native';
import type { GetProps } from 'tamagui';

const SCROLL_EDGE_DELAY_MS = 500;
const MIN_SCROLL_DURATION_MS = 1000;
const MAX_SCROLL_DURATION_MS = 5200;
const SCROLL_DURATION_STEP_MS = 200;

function getScrollDuration(scrollDistance: number) {
  const overflowCharCount = Math.max(
    1,
    Math.ceil(scrollDistance / INVITE_CODE_COLUMN_CODE_CHAR_WIDTH),
  );

  return Math.min(
    MAX_SCROLL_DURATION_MS,
    MIN_SCROLL_DURATION_MS + overflowCharCount * SCROLL_DURATION_STEP_MS,
  );
}

interface IMarqueeTextProps {
  children: string;
  containerWidth: number;
  textProps?: Partial<GetProps<typeof SizableText>>;
}

function MarqueeTextImpl({
  children,
  containerWidth,
  textProps,
}: IMarqueeTextProps) {
  const translateX = useSharedValue(0);
  const [textWidth, setTextWidth] = useState(0);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = Math.ceil(event.nativeEvent.layout.width);

    setTextWidth((prevWidth) =>
      prevWidth === nextWidth ? prevWidth : nextWidth,
    );
  }, []);

  useEffect(() => {
    const scrollDistance = textWidth - containerWidth;

    cancelAnimation(translateX);
    translateX.value = 0;

    if (scrollDistance <= 0) {
      return;
    }

    const duration = getScrollDuration(scrollDistance);

    translateX.value = withRepeat(
      withSequence(
        withDelay(
          SCROLL_EDGE_DELAY_MS,
          withTiming(-scrollDistance, {
            duration,
            easing: Easing.linear,
          }),
        ),
        withDelay(
          SCROLL_EDGE_DELAY_MS,
          withTiming(0, {
            duration,
            easing: Easing.linear,
          }),
        ),
      ),
      -1,
      false,
    );

    return () => {
      cancelAnimation(translateX);
      translateX.value = 0;
    };
  }, [children, containerWidth, textWidth, translateX]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <XStack width={containerWidth} overflow="hidden" position="relative">
      <XStack
        position="absolute"
        opacity={0}
        pointerEvents="none"
        alignSelf="flex-start"
        onLayout={handleLayout}
      >
        <SizableText {...textProps}>{children}</SizableText>
      </XStack>
      <Animated.View
        style={[
          animatedStyle,
          {
            width: textWidth || undefined,
            flexShrink: 0,
            alignSelf: 'flex-start',
          },
        ]}
      >
        <SizableText {...textProps} numberOfLines={1} ellipsizeMode="clip">
          {children}
        </SizableText>
      </Animated.View>
    </XStack>
  );
}

export const MarqueeText = memo(MarqueeTextImpl);
