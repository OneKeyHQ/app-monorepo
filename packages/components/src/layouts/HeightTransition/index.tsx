import type { ComponentProps } from 'react';

import { StyleSheet } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { MotiView } from 'moti';

const styles = StyleSheet.create({
  autoBottom: {
    bottom: 'auto',
  },
  hidden: {
    overflow: 'hidden',
  },
});

export type IHeightTransitionProps = {
  children?: React.ReactNode;
  /**
   * If `true`, the height will automatically animate to 0. Default: `false`.
   */
  hide?: boolean;
  initialHeight?: number;
  onHeightDidAnimate?: (height: number) => void;
} & ComponentProps<typeof MotiView>;

const transition = { duration: 200 } as const;

function HeightTransition({
  children,
  hide = !children,
  style,
  onHeightDidAnimate,
  initialHeight = 0,
}: IHeightTransitionProps) {
  const measuredHeight = useSharedValue(initialHeight);
  const childStyle = useAnimatedStyle(
    () => ({
      opacity: withTiming(!measuredHeight.value || hide ? 0 : 1, transition),
    }),
    [hide, measuredHeight],
  );

  const containerStyle = useAnimatedStyle(
    () => ({
      height: withTiming(hide ? 0 : measuredHeight.value, transition, () => {
        if (onHeightDidAnimate) {
          runOnJS(onHeightDidAnimate)(measuredHeight.value);
        }
      }),
    }),
    [hide, measuredHeight],
  );

  return (
    <Animated.View style={[styles.hidden, style, containerStyle]}>
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.autoBottom, childStyle]}
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
