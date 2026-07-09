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
  disabled = false,
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
  onGestureActiveChange,
  excludeBottomEdgeHeight = 0,
}: PropsWithChildren<IHeaderScrollGestureWrapperProps>) {
  const tabsContext = useContext(CollapsibleTabContext);
  const refMap = tabsContext?.refMap;
  const focusedTab = tabsContext?.focusedTab;
  const scrollYCurrent = tabsContext?.scrollYCurrent;
  const contentInset = tabsContext?.contentInset ?? 0;

  const startScrollY = useSharedValue(0);
  const targetScrollY = useSharedValue(0);
  const containerWidth = useSharedValue(0);
  const containerHeight = useSharedValue(0);
  const isGestureEnabled = useSharedValue(true);
  const hasNotifiedGestureActive = useSharedValue(false);
  const [measuredWidth, setMeasuredWidth] = useState(0);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const layoutWidth = event.nativeEvent.layout.width;
      const layoutHeight = event.nativeEvent.layout.height;
      containerWidth.value = layoutWidth;
      containerHeight.value = layoutHeight;
      setMeasuredWidth((currentWidth) =>
        currentWidth === layoutWidth ? currentWidth : layoutWidth,
      );
    },
    [containerHeight, containerWidth],
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
    const safeExcludeBottomEdgeHeight = Math.max(0, excludeBottomEdgeHeight);
    const gestureHitSlop =
      excludedRightEdgeWidth > 0 || safeExcludeBottomEdgeHeight > 0
        ? {
            ...(excludedRightEdgeWidth > 0
              ? { right: -excludedRightEdgeWidth }
              : {}),
            ...(safeExcludeBottomEdgeHeight > 0
              ? { bottom: -safeExcludeBottomEdgeHeight }
              : {}),
          }
        : undefined;
    const shouldIgnoreByStartPoint = (x: number, y: number) => {
      'worklet';

      if (safeExcludeRightEdgeRatio > 0 && containerWidth.value > 0) {
        const excludedStartX =
          containerWidth.value * (1 - safeExcludeRightEdgeRatio);
        if (x >= excludedStartX) {
          return true;
        }
      }

      if (
        safeExcludeBottomEdgeHeight > 0 &&
        containerHeight.value > safeExcludeBottomEdgeHeight
      ) {
        return y >= containerHeight.value - safeExcludeBottomEdgeHeight;
      }

      return false;
    };

    let verticalPanGesture = Gesture.Pan()
      .enabled(!disabled)
      .activeOffsetY(panActiveOffsetY)
      .failOffsetX(panFailOffsetX);

    if (gestureHitSlop) {
      verticalPanGesture = verticalPanGesture.hitSlop(gestureHitSlop);
    }

    verticalPanGesture =
      verticalPanGesture.cancelsTouchesInView(cancelChildTouches);
    verticalPanGesture = verticalPanGesture
      .onStart((e) => {
        'worklet';

        isGestureEnabled.value = !shouldIgnoreByStartPoint(e.x, e.y);
        if (!isGestureEnabled.value) {
          hasNotifiedGestureActive.value = false;
          return;
        }
        cancelAnimation(targetScrollY);
        startScrollY.value = scrollYCurrent?.value ?? 0;
        if (onGestureActiveChange) {
          hasNotifiedGestureActive.value = true;
          runOnJS(onGestureActiveChange)(true);
        }
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

        if (hasNotifiedGestureActive.value && onGestureActiveChange) {
          runOnJS(onGestureActiveChange)(false);
        }
        hasNotifiedGestureActive.value = false;
        isGestureEnabled.value = true;
      });

    if (!onHorizontalSwipe) {
      if (!simultaneousWithNativeGesture) {
        return verticalPanGesture;
      }
      return Gesture.Simultaneous(Gesture.Native(), verticalPanGesture);
    }

    let horizontalPanGesture = Gesture.Pan()
      .enabled(!disabled)
      .activeOffsetX([-10, 10])
      .failOffsetY([-10, 10]);

    if (gestureHitSlop) {
      horizontalPanGesture = horizontalPanGesture.hitSlop(gestureHitSlop);
    }

    horizontalPanGesture =
      horizontalPanGesture.cancelsTouchesInView(cancelChildTouches);
    horizontalPanGesture = horizontalPanGesture
      .onStart((e) => {
        'worklet';

        isGestureEnabled.value = !shouldIgnoreByStartPoint(e.x, e.y);
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
    excludeBottomEdgeHeight,
    scrollScale,
    onHorizontalSwipe,
    horizontalSwipeThreshold,
    horizontalSwipeVelocityThreshold,
    simultaneousWithNativeGesture,
    cancelChildTouches,
    onGestureActiveChange,
    disabled,
    containerHeight,
    containerWidth,
    measuredWidth,
    isGestureEnabled,
    hasNotifiedGestureActive,
  ]);

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View onLayout={handleLayout}>{children}</Animated.View>
    </GestureDetector>
  );
}
