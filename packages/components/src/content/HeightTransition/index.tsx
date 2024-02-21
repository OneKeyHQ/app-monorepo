import type { ComponentProps } from 'react';

import { StyleSheet } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { MotiView } from 'moti';

const styles = StyleSheet.create({
  hidden: {
    overflow: 'hidden',
  },
});

export type IHeightTransitionProps = {
  children?: React.ReactNode;
  initialHeight?: number;
  onHeightDidAnimate?: (height: number) => void;
} & ComponentProps<typeof MotiView>;

const transition = { duration: 150 } as const;

function HeightTransition({
  children,
  style,
  onHeightDidAnimate,
  initialHeight = 0,
}: IHeightTransitionProps) {
  const measuredHeight = useSharedValue(initialHeight);
  const childStyle = useAnimatedStyle(
    () => ({
      opacity: withTiming(!measuredHeight.value ? 0 : 1, transition),
      transform: [
        {
          translateY: withSequence(
            withTiming(-measuredHeight.value, { duration: 0 }),
            withTiming(0, transition, () => {
              if (onHeightDidAnimate) {
                runOnJS(onHeightDidAnimate)(measuredHeight.value);
              }
            }),
          ),
        },
      ],
    }),
    [],
  );

  return (
    <Animated.View style={[styles.hidden, style]}>
      <Animated.View
        style={childStyle}
        onLayout={({ nativeEvent }) => {
          measuredHeight.value = Math.ceil(nativeEvent.layout.height);
        }}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
}

export { HeightTransition };
