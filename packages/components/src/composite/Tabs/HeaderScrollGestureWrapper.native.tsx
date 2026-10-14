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

import { Haptics, ImpactFeedbackStyle } from '../../primitives/Haptics';

import { CollapsibleTabContext } from './CollapsibleTabContext';
import { HeaderScrollGestureContext } from './HeaderScrollGestureContext';

import type { IHeaderScrollGestureWrapperProps } from './HeaderScrollGestureWrapper';
import type { LayoutChangeEvent } from 'react-native';

const REFRESH_THRESHOLD = 80;

export function HeaderScrollGestureWrapper({
  children,
  disabled = false,
  disableVerticalScroll = false,
  onRefresh,
  disableMomentum = false,
  panActiveOffsetY = [-10, 10],
  panFailOffsetX = [-10, 10],
  verticalPanMinVelocity = 0,
  verticalPanMaxPointers,
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
  const isVerticalPanPointerCountExceeded = useSharedValue(false);
  const hasNotifiedGestureActive = useSharedValue(false);
  const hasTriggeredRefreshHaptic = useSharedValue(false);
  const pendingPanStart = useSharedValue<{
    x: number;
    y: number;
    time: number;
  } | null>(null);
  const [measuredWidth, setMeasuredWidth] = useState(0);

  const triggerRefreshHaptic = useCallback(() => {
    Haptics.impact(ImpactFeedbackStyle.Medium);
  }, []);

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

  const { panGesture, scrollGestures } = useMemo(() => {
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

    // Keep native recognition behind the same touch slop as the speed decision.
    // Otherwise UIKit can start its pan before a slow drag is released to a child.
    let verticalPanGesture = Gesture.Pan()
      .enabled(!disabled && !disableVerticalScroll)
      .activeOffsetY(panActiveOffsetY)
      .failOffsetX(panFailOffsetX);

    if (verticalPanMinVelocity > 0) {
      verticalPanGesture = verticalPanGesture
        .manualActivation(true)
        .onTouchesMove((event, manager) => {
          'worklet';

          const start = pendingPanStart.value;
          const touch = event.allTouches[0];
          if (!start || !touch) {
            return;
          }
          const dx = touch.absoluteX - start.x;
          const dy = touch.absoluteY - start.y;
          if (dx < panFailOffsetX[0] || dx > panFailOffsetX[1]) {
            pendingPanStart.value = null;
            manager.fail();
            return;
          }
          if (dy >= panActiveOffsetY[0] && dy <= panActiveOffsetY[1]) {
            return;
          }

          // Decide once, after touch slop, so a chart drag cannot turn into
          // a page scroll when the finger accelerates later in the gesture.
          const velocityY =
            (Math.abs(dy) * 1000) / Math.max(1, Date.now() - start.time);
          pendingPanStart.value = null;
          if (velocityY >= verticalPanMinVelocity) {
            manager.activate();
          } else {
            manager.fail();
          }
        });
    }

    if (verticalPanMaxPointers !== undefined) {
      verticalPanGesture = verticalPanGesture.maxPointers(
        verticalPanMaxPointers,
      );
    }
    if (verticalPanMaxPointers !== undefined || verticalPanMinVelocity > 0) {
      verticalPanGesture = verticalPanGesture.onTouchesDown(
        (event, manager) => {
          'worklet';

          // maxPointers only rejects extra pointers before activation, so
          // latch an active page pan off for the rest of a multi-touch gesture.
          if (
            verticalPanMaxPointers !== undefined &&
            event.numberOfTouches > verticalPanMaxPointers
          ) {
            isVerticalPanPointerCountExceeded.value = true;
            cancelAnimation(targetScrollY);
            if (pendingPanStart.value) {
              pendingPanStart.value = null;
              manager.fail();
            }
            return;
          }
          if (verticalPanMinVelocity > 0 && event.numberOfTouches === 1) {
            const touch = event.changedTouches[0];
            if (!touch || shouldIgnoreByStartPoint(touch.x, touch.y)) {
              manager.fail();
              return;
            }
            pendingPanStart.value = {
              x: touch.absoluteX,
              y: touch.absoluteY,
              time: Date.now(),
            };
          }
        },
      );
    }

    if (gestureHitSlop) {
      verticalPanGesture = verticalPanGesture.hitSlop(gestureHitSlop);
    }

    verticalPanGesture =
      verticalPanGesture.cancelsTouchesInView(cancelChildTouches);
    verticalPanGesture = verticalPanGesture
      .onStart((e) => {
        'worklet';

        hasTriggeredRefreshHaptic.value = false;
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

        if (
          !isGestureEnabled.value ||
          isVerticalPanPointerCountExceeded.value
        ) {
          return;
        }
        targetScrollY.value = startScrollY.value - e.translationY * scrollScale;
        const isRefreshThresholdReached =
          startScrollY.value <= contentInset &&
          e.translationY > REFRESH_THRESHOLD;
        if (
          onRefresh &&
          isRefreshThresholdReached &&
          !hasTriggeredRefreshHaptic.value
        ) {
          hasTriggeredRefreshHaptic.value = true;
          runOnJS(triggerRefreshHaptic)();
        }
      })
      .onEnd((e) => {
        'worklet';

        if (
          !isGestureEnabled.value ||
          isVerticalPanPointerCountExceeded.value
        ) {
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
        pendingPanStart.value = null;
        isVerticalPanPointerCountExceeded.value = false;
        isGestureEnabled.value = true;
      });

    if (!onHorizontalSwipe) {
      return {
        panGesture: simultaneousWithNativeGesture
          ? Gesture.Simultaneous(Gesture.Native(), verticalPanGesture)
          : verticalPanGesture,
        scrollGestures: [verticalPanGesture],
      };
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

    return {
      panGesture: simultaneousWithNativeGesture
        ? Gesture.Simultaneous(Gesture.Native(), raceGesture)
        : raceGesture,
      scrollGestures: [verticalPanGesture, horizontalPanGesture],
    };
  }, [
    startScrollY,
    scrollYCurrent,
    targetScrollY,
    contentInset,
    onRefresh,
    disableMomentum,
    panActiveOffsetY,
    panFailOffsetX,
    verticalPanMinVelocity,
    verticalPanMaxPointers,
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
    disableVerticalScroll,
    containerHeight,
    containerWidth,
    measuredWidth,
    isGestureEnabled,
    isVerticalPanPointerCountExceeded,
    hasNotifiedGestureActive,
    hasTriggeredRefreshHaptic,
    pendingPanStart,
    triggerRefreshHaptic,
  ]);

  return (
    <HeaderScrollGestureContext.Provider value={scrollGestures}>
      <GestureDetector gesture={panGesture}>
        <Animated.View onLayout={handleLayout}>{children}</Animated.View>
      </GestureDetector>
    </HeaderScrollGestureContext.Provider>
  );
}
