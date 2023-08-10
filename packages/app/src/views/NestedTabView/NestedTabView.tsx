/* eslint-disable @typescript-eslint/no-use-before-define */
import type { ForwardRefRenderFunction } from 'react';
import {
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  // useState,
} from 'react';

import { UIManager, findNodeHandle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue, withTiming } from 'react-native-reanimated';

import { Box, useIsVerticalLayout } from '@onekeyhq/components';
import { enableOnPressAnim } from '@onekeyhq/components/src/utils/useBeforeOnPress';
// import { useNavigationActions } from '@onekeyhq/kit/src/hooks';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import NativeNestedTabView from './NativeNestedTabView';

import type { NestedTabViewProps, OnPageChangeEvent } from './types';
import type { NativeSyntheticEvent } from 'react-native';

export type ForwardRefHandle = {
  setPageIndex: (pageIndex: number) => void;
  setRefreshing: (refreshing: boolean) => void;
};

// const failedDistance = 5;
// const drawerOpenDistance = 50;

enum LockDirection {
  None = 0,
  Vertical = 1,
  Horizontal = 2,
}

const STATIC_GESTURE_PAN = Gesture.Pan();
const NestedTabView: ForwardRefRenderFunction<
  ForwardRefHandle,
  NestedTabViewProps
> = (
  {
    headerView,
    children,
    onPageChange,
    onPageStartScroll,
    defaultIndex,
    scrollEnabled = true,
    ...rest
  },
  ref,
) => {
  const isScrolling = useRef(false);
  const isVerticalLayout = useIsVerticalLayout();
  const enableOpenDrawer = rest.canOpenDrawer && isVerticalLayout;
  // disable drawer swipe gesture
  // const { openDrawer } = useNavigationActions();
  const tabRef = useRef<typeof NativeNestedTabView>(null);
  // // const { width: screenWidth } = useWindowDimensions();
  const tabIndex = useSharedValue(defaultIndex);
  // const offsetX = useSharedValue(0);
  const lockDirection = useSharedValue(LockDirection.None);

  // // only used on android cause touchMove event does not have translation values
  const lastTransX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startX = useSharedValue(0);
  const native = Gesture.Native();

  // const [disableTabSlide, setDisableTabSlide] = useState(false);

  const lockVertical = useCallback(() => {
    // when fingers move,
    // disable the onPress function
    enableOnPressAnim.value = 0;
    if (platformEnv.isNativeAndroid) {
      // console.log('lockVertical');
      lockDirection.value = LockDirection.Vertical;
      lastTransX.value = 0;
      pan.enabled(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastTransX, lockDirection]);

  const lockHorizontal = useCallback(() => {
    // when fingers move,
    // disable the onPress function
    enableOnPressAnim.value = 0;
    if (platformEnv.isNativeAndroid) {
      // console.log('lockHorizontal');
      // setInnerDisableRefresh(false);
      // setDisableTabSlide(true);
      lockDirection.value = LockDirection.Horizontal;
    }
  }, [lockDirection]);

  const resetGesture = useCallback(() => {
    lastTransX.value = 0;
    if (platformEnv.isNativeAndroid) {
      // console.log('resetGesture');
      lockDirection.value = LockDirection.None;
      // setDisableTabSlide(false);
      pan.enabled(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastTransX, lockDirection]);

  const setPageIndex = useCallback((pageIndex: number) => {
    try {
      UIManager.dispatchViewManagerCommand(
        findNodeHandle(tabRef.current),
        'setPageIndex',
        [pageIndex],
      );
    } catch (error) {
      debugLogger.common.error(`switch account tab error`, error);
    }
  }, []);

  const setRefreshing = useCallback((refreshing: boolean) => {
    try {
      UIManager.dispatchViewManagerCommand(
        findNodeHandle(tabRef.current),
        'setRefreshing',
        [refreshing],
      );
    } catch (error) {
      debugLogger.common.error(`set refreshing error`, error);
    }
  }, []);

  useImperativeHandle(ref, () => ({
    setPageIndex,
    setRefreshing,
  }));

  // const canOpenDrawer = useCallback(() => {
  //   if (!platformEnv.isNativeAndroid) {
  //     return lastTransX.value > drawerOpenDistance;
  //   }

  //   return (
  //     lastTransX.value > drawerOpenDistance &&
  //     lockDirection.value === LockDirection.Vertical
  //   );
  // }, [lastTransX.value, lockDirection.value]);

  const onEnd = useCallback(() => {
    // if (enableOpenDrawer) {
    //   if (tabIndex.value === 0) {
    // console.log('lastTransX', lastTransX.value);
    // if (canOpenDrawer()) {
    // openDrawer();
    // nestedTabTransX.value = withSpring(0, {
    //   velocity: 50,
    //   stiffness: 1000,
    //   damping: 500,
    //   mass: 3,
    //   overshootClamping: true,
    //   restDisplacementThreshold: 0.01,
    //   restSpeedThreshold: 0.01,
    // });
    // } else {
    //   resetNestedTabTransX();
    // }
    // }
    resetGesture();
    // }

    // restore the onPress function
    enableOnPressAnim.value = withTiming(1, { duration: 200 });
  }, [
    // enableOpenDrawer,
    // tabIndex.value,
    resetGesture,
    // canOpenDrawer,
    // openDrawer,
  ]);

  const pan = useMemo(() => {
    if (platformEnv.isNativeIOS) {
      return STATIC_GESTURE_PAN;
    }
    // return STATIC_GESTURE_PAN;
    const basePan = Gesture.Pan();
    if (enableOpenDrawer) {
      basePan.onTouchesDown(() =>
        // { allTouches }
        {
          resetGesture();
          // nestedTabStartX.value = allTouches[0].absoluteX;
          // startY.value = allTouches[0].absoluteY;
          // startX.value = allTouches[0].absoluteX;
          // offsetX.value = nestedTabTransX.value;
        },
      );
    }
    // if (platformEnv.isNativeIOS) {
    //   // onUpdate works better on IOS
    //   basePan.onUpdate(({ translationX }) => {
    //     // console.log('update', e);
    //     // when fingers move,
    //     // disable the onPress function
    //     enableOnPressAnim.value = 0;
    //     if (enableOpenDrawer && tabIndex.value === 0 && translationX > 0) {
    //       nestedTabTransX.value = offsetX.value + translationX;
    //       lastTransX.value = translationX;
    //     }
    //   });
    // }
    if (platformEnv.isNativeAndroid) {
      // onTouchesMove works better on Android
      basePan.onTouchesMove(({ allTouches }) => {
        if (lockDirection.value === LockDirection.None) {
          // Determine vertical or horizontal by sliding 20
          if (
            Math.abs(allTouches[0].absoluteX - startX.value) < 20 &&
            Math.abs(allTouches[0].absoluteY - startY.value) < 20
          ) {
            return;
          }

          if (
            Math.abs(allTouches[0].absoluteY - startY.value) >
            Math.abs(allTouches[0].absoluteX - startX.value)
          ) {
            lockHorizontal();
            return;
          }
          lockVertical();
        }

        // use Math.max to ensure the translation always increase
        // const transX = allTouches[0].absoluteX - nestedTabStartX.value;
        // lastTransX.value = transX;
        // if (
        //   lockDirection.value === LockDirection.Vertical &&
        //   enableOpenDrawer &&
        //   tabIndex.value === 0 &&
        //   transX > failedDistance
        // ) {
        //   nestedTabTransX.value = offsetX.value + transX;
        // }
      });
    }
    return basePan.onFinalize(onEnd);
  }, [
    enableOpenDrawer,
    // lastTransX,
    lockDirection.value,
    lockHorizontal,
    lockVertical,
    // offsetX,
    onEnd,
    resetGesture,
    startX,
    startY,
    // tabIndex.value,
  ]);

  const onTabChange = useCallback(
    (e: OnPageChangeEvent) => {
      tabIndex.value = e.nativeEvent.index;
      onPageChange?.(e);
      isScrolling.current = false;
    },
    [onPageChange, tabIndex],
  );

  const onStartChangeCall = useCallback(() => {
    isScrolling.current = true;
    onPageStartScroll?.();
  }, [onPageStartScroll]);

  const onMoveShouldSetResponderCapture = useCallback(() => {
    if (platformEnv.isNativeIOS) return false;
    return isScrolling.current;
  }, []);

  const content = (
    <NativeNestedTabView
      defaultIndex={defaultIndex}
      onPageChange={onTabChange}
      onPageStartScroll={onStartChangeCall}
      scrollEnabled={scrollEnabled}
      // disableTabSlide={disableTabSlide}
      onMoveShouldSetResponderCapture={onMoveShouldSetResponderCapture}
      disableTabSlide={false}
      // @ts-ignore
      ref={tabRef}
      {...rest}
    >
      {/* native code get first child as header */}
      <Box>{headerView}</Box>
      {children}
    </NativeNestedTabView>
  );

  return content;

  return (
    <GestureDetector
      gesture={
        // eslint-disable-next-line no-nested-ternary
        // platformEnv.isNativeAndroid
        //   ? Gesture.Exclusive(native, pan)
        //   : enableOpenDrawer
        //   ? Gesture.Simultaneous(native, pan)
        //   : // to solve ios system back gesture conflict
        //     // in tab pages without drawer
        Gesture.Race(native, pan)
        // Gesture.Race(native, pan)
      }
    >
      {content}
    </GestureDetector>
  );
};

export default memo(forwardRef(NestedTabView));
