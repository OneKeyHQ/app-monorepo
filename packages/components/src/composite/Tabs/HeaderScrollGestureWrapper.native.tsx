import type { PropsWithChildren } from 'react';
import { useCallback, useContext, useMemo, useState } from 'react';

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
import type { LayoutChangeEvent } from 'react-native';

const REFRESH_THRESHOLD = 80;

export function HeaderScrollGestureWrapper({
  children,
  onRefresh,
  disableMomentum = false,
  panActiveOffsetY = [-10, 10],
  panFailOffsetX = [-10, 10],
  excludeRightEdgeRatio = 0,
  scrollScale = 1,
  onHorizontalSwipe,
  horizontalSwipeThreshold = 40,
  horizontalSwipeVelocityThreshold = 0,
  simultaneousWithNativeGesture = false,
  cancelChildTouches = true,
}: PropsWithChildren<IHeaderScrollGestureWrapperProps>) {
  const tabsContext = useContext(CollapsibleTabContext);
  const refMap = tabsContext?.refMap;
  const focusedTab = tabsContext?.focusedTab;
  const scrollYCurrent = tabsContext?.scrollYCurrent;
  const contentInset = tabsContext?.contentInset ?? 0;

  const startScrollY = useSharedValue(0);
  const targetScrollY = useSharedValue(0);
  const containerWidth = useSharedValue(0);
  const isGestureEnabled = useSharedValue(true);
  const [measuredWidth, setMeasuredWidth] = useState(0);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const layoutWidth = event.nativeEvent.layout.width;
      containerWidth.value = layoutWidth;
      setMeasuredWidth((currentWidth) =>
        currentWidth === layoutWidth ? currentWidth : layoutWidth,
      );
    },
    [containerWidth],
  );

  useAnimatedReaction(
    () => targetScrollY.value,
    (currentValue) => {
      if (refMap && focusedTab) {
        const ref = refMap[focusedTab.value];
        if (ref) {
          scrollTo(ref, 0, currentValue - contentInset, false);
        }
      }
    },
  );

  const panGesture = useMemo(() => {
    const safeExcludeRightEdgeRatio = Math.max(
      0,
      Math.min(1, excludeRightEdgeRatio),
    );
    const excludedRightEdgeWidth =
      safeExcludeRightEdgeRatio > 0 && measuredWidth > 0
        ? measuredWidth * safeExcludeRightEdgeRatio
        : 0;
    const gestureHitSlop =
      excludedRightEdgeWidth > 0
        ? {
            right: -excludedRightEdgeWidth,
          }
        : undefined;
    const shouldIgnoreByStartX = (x: number) => {
      'worklet';

      if (safeExcludeRightEdgeRatio <= 0 || containerWidth.value <= 0) {
        return false;
      }
      const excludedStartX =
        containerWidth.value * (1 - safeExcludeRightEdgeRatio);
      return x >= excludedStartX;
    };

    let verticalPanGesture = Gesture.Pan()
      .activeOffsetY(panActiveOffsetY)
      .failOffsetX(panFailOffsetX);

    if (gestureHitSlop) {
      verticalPanGesture = verticalPanGesture.hitSlop(gestureHitSlop);
    }

    verticalPanGesture = verticalPanGesture
      .cancelsTouchesInView(cancelChildTouches)
      .onStart((e) => {
        'worklet';

        isGestureEnabled.value = !shouldIgnoreByStartX(e.x);
        if (!isGestureEnabled.value) {
          return;
        }
        cancelAnimation(targetScrollY);
        startScrollY.value = scrollYCurrent?.value ?? 0;
      })
      .onUpdate((e) => {
        'worklet';

        if (!isGestureEnabled.value) {
          return;
        }
        targetScrollY.value = startScrollY.value - e.translationY * scrollScale;
      })
      .onEnd((e) => {
        'worklet';

        if (!isGestureEnabled.value) {
          return;
        }
        const wasAtTop = startScrollY.value <= contentInset;
        const pulledDown = e.translationY > REFRESH_THRESHOLD;
        if (wasAtTop && pulledDown && onRefresh) {
          runOnJS(onRefresh)();
        } else if (!disableMomentum) {
          targetScrollY.value = withDecay({
            velocity: -e.velocityY,
          });
        }
      })
      .onFinalize(() => {
        'worklet';

        isGestureEnabled.value = true;
      });

    if (!onHorizontalSwipe) {
      if (!simultaneousWithNativeGesture) {
        return verticalPanGesture;
      }
      return Gesture.Simultaneous(Gesture.Native(), verticalPanGesture);
    }

    let horizontalPanGesture = Gesture.Pan()
      .activeOffsetX([-10, 10])
      .failOffsetY([-10, 10]);

    if (gestureHitSlop) {
      horizontalPanGesture = horizontalPanGesture.hitSlop(gestureHitSlop);
    }

    horizontalPanGesture = horizontalPanGesture
      .cancelsTouchesInView(cancelChildTouches)
      .onStart((e) => {
        'worklet';

        isGestureEnabled.value = !shouldIgnoreByStartX(e.x);
      })
      .onEnd((e) => {
        'worklet';

        if (!isGestureEnabled.value) {
          return;
        }
        const absTranslationX = Math.abs(e.translationX);
        const absVelocityX = Math.abs(e.velocityX);
        const isDistanceReached = absTranslationX >= horizontalSwipeThreshold;
        const isFastSwipe =
          horizontalSwipeVelocityThreshold > 0 &&
          absVelocityX >= horizontalSwipeVelocityThreshold;

        if (!isDistanceReached && !isFastSwipe) {
          return;
        }
        runOnJS(onHorizontalSwipe)(e.translationX < 0 ? 'left' : 'right');
      })
      .onFinalize(() => {
        'worklet';

        isGestureEnabled.value = true;
      });

    const raceGesture = Gesture.Race(horizontalPanGesture, verticalPanGesture);

    if (!simultaneousWithNativeGesture) {
      return raceGesture;
    }
    return Gesture.Simultaneous(Gesture.Native(), raceGesture);
  }, [
    startScrollY,
    scrollYCurrent,
    targetScrollY,
    contentInset,
    onRefresh,
    disableMomentum,
    panActiveOffsetY,
    panFailOffsetX,
    excludeRightEdgeRatio,
    scrollScale,
    onHorizontalSwipe,
    horizontalSwipeThreshold,
    horizontalSwipeVelocityThreshold,
    simultaneousWithNativeGesture,
    cancelChildTouches,
    containerWidth,
    measuredWidth,
    isGestureEnabled,
  ]);

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View onLayout={handleLayout}>{children}</Animated.View>
    </GestureDetector>
  );
}
