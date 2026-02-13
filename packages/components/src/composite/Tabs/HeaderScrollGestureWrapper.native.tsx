import type { PropsWithChildren } from 'react';
import { useContext, useMemo } from 'react';

import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  runOnJS,
  scrollTo,
  useAnimatedReaction,
  useSharedValue,
  withDecay,
} from 'react-native-reanimated';

import { CollapsibleTabContext } from './CollapsibleTabContext';

import type { IHeaderScrollGestureWrapperProps } from './HeaderScrollGestureWrapper';

const REFRESH_THRESHOLD = 80;

export function HeaderScrollGestureWrapper({
  children,
  onRefresh,
}: PropsWithChildren<IHeaderScrollGestureWrapperProps>) {
  const tabsContext = useContext(CollapsibleTabContext);
  const refMap = tabsContext?.refMap;
  const focusedTab = tabsContext?.focusedTab;
  const scrollYCurrent = tabsContext?.scrollYCurrent;
  const contentInset = tabsContext?.contentInset ?? 0;

  const startScrollY = useSharedValue(0);
  const targetScrollY = useSharedValue(0);

  useAnimatedReaction(
    () => targetScrollY.value,
    (currentValue) => {
      if (refMap && focusedTab) {
        const ref = refMap[focusedTab.value];
        if (ref) {
          scrollTo(ref, 0, Math.max(0, currentValue - contentInset), false);
        }
      }
    },
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-10, 10])
        .failOffsetX([-10, 10])
        .onStart(() => {
          'worklet';
          cancelAnimation(targetScrollY);
          startScrollY.value = scrollYCurrent?.value ?? 0;
        })
        .onUpdate((e) => {
          'worklet';
          targetScrollY.value = startScrollY.value - e.translationY;
        })
        .onEnd((e) => {
          'worklet';
          const wasAtTop = startScrollY.value <= contentInset;
          const pulledDown = e.translationY > REFRESH_THRESHOLD;
          if (wasAtTop && pulledDown && onRefresh) {
            runOnJS(onRefresh)();
          } else {
            targetScrollY.value = withDecay({
              velocity: -e.velocityY,
            });
          }
        }),
    [startScrollY, scrollYCurrent, targetScrollY, contentInset, onRefresh],
  );

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View>{children}</Animated.View>
    </GestureDetector>
  );
}
