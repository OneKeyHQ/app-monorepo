import { type PropsWithChildren, useContext, useEffect, useMemo } from 'react';

import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Stack } from '../../primitives';

import { PageContext } from './PageContext';

import type { StackStyleProps } from '@tamagui/web/types/types';

export function PageBody({
  children,
  ...props
}: PropsWithChildren<StackStyleProps>) {
  const avoidHeightValue = useSharedValue(0);
  const { options = {} } = useContext(PageContext);
  const animatedStyles = useAnimatedStyle(() => ({
    bottom: avoidHeightValue.value,
  }));
  const { avoidHeight } = options;
  useEffect(() => {
    avoidHeightValue.value = withTiming(avoidHeight || 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avoidHeight]);
  return useMemo(
    () => (
      <Animated.View style={[{ flex: 1 }, animatedStyles]}>
        <Stack flex={1} {...props}>
          {children}
        </Stack>
      </Animated.View>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [children, props],
  );
}
