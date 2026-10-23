import { useCallback, useMemo, useRef } from 'react';
import type { PropsWithChildren } from 'react';

import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { BROWSER_ADDRESS_SWIPE_DISTANCE } from '../../config/Animation.constants';

const styles = StyleSheet.create({
  // Fill the capsule row so the address keeps its full tap area.
  area: { flex: 1, alignSelf: 'stretch', justifyContent: 'center' },
});

const springConfig = { damping: 18, stiffness: 220 };
// Follow the finger with resistance, like Safari's address bar.
const DRAG_RESISTANCE = 0.5;

// Horizontal swipe on the address switches to the neighbouring tab
// (left = next, right = previous). Taps inside still reach their handlers:
// the pan only activates after a clear horizontal movement.
export function AddressSwipeArea({
  children,
  onSwipe,
}: PropsWithChildren<{ onSwipe: (direction: 1 | -1) => void }>) {
  const translateX = useSharedValue(0);
  // Keep the gesture stable while the handler identity changes.
  const onSwipeRef = useRef(onSwipe);
  onSwipeRef.current = onSwipe;
  const handleSwipe = useCallback((direction: 1 | -1) => {
    onSwipeRef.current(direction);
  }, []);
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-12, 12])
        .failOffsetY([-12, 12])
        .onUpdate((event) => {
          'worklet';

          translateX.value = event.translationX * DRAG_RESISTANCE;
        })
        .onEnd((event) => {
          'worklet';

          if (Math.abs(event.translationX) >= BROWSER_ADDRESS_SWIPE_DISTANCE) {
            runOnJS(handleSwipe)(event.translationX < 0 ? 1 : -1);
          }
        })
        .onFinalize(() => {
          'worklet';

          translateX.value = withSpring(0, springConfig);
        }),
    [handleSwipe, translateX],
  );
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      Math.abs(translateX.value),
      [0, BROWSER_ADDRESS_SWIPE_DISTANCE],
      [1, 0.4],
      'clamp',
    ),
    transform: [{ translateX: translateX.value }],
  }));
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.area, animatedStyle]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
