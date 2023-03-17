import type { ForwardRefRenderFunction } from 'react';
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

// import { useWindowDimensions } from 'react-native';
import ReactNative, { UIManager } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { enableOnPressAnim } from '@onekeyhq/components/src/utils/beforeOnPress';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import NativeNestedTabView, {
  getViewManagerConfig,
} from './NativeNestedTabView';
import {
  nestedTabStartX,
  nestedTabTransX,
  resetNestedTabTransX,
} from './types';

import type { NestedTabViewProps } from './types';
import type { NativeSyntheticEvent } from 'react-native';

export type ForwardRefHandle = {
  setPageIndex: (pageIndex: number) => void;
};

const failedDistance = 5;
const drawerOpenDistance = 50;
enum LockDirection {
  None = 0,
  Vertical = 1,
  Horizontal = 2,
}
const native = Gesture.Native();
const NestedTabView: ForwardRefRenderFunction<
  ForwardRefHandle,
  NestedTabViewProps
> = (
  {
    renderHeader,
    children,
    onChange,
    defaultIndex,
    canOpenDrawer,
    scrollEnabled,
    disableRefresh = false,
    ...rest
  },
  ref,
) => {
  const [innerDisableRefresh, setInnerDisableRefresh] =
    useState(disableRefresh);
  const tabRef = useRef<typeof NativeNestedTabView>(null);
  // const { width: screenWidth } = useWindowDimensions();
  const tabIndex = useSharedValue(defaultIndex);
  const offsetX = useSharedValue(0);
  const lockDirection = useSharedValue(LockDirection.None);

  // only used on android cause touchMove event does not have translation values
  const lastTransX = useSharedValue(0);
  const startY = useSharedValue(0);

  useImperativeHandle(ref, () => ({
    setPageIndex: (pageIndex: number) => {
      try {
        UIManager.dispatchViewManagerCommand(
          ReactNative.findNodeHandle(tabRef.current),
          getViewManagerConfig().Commands.setPageIndex,
          [pageIndex],
        );
      } catch (error) {
        debugLogger.common.error(`switch account tab error`, error);
      }
    },
  }));

  const onEnd = useCallback(
    () => {
      if (canOpenDrawer && tabIndex.value === 0) {
        if (lastTransX.value > drawerOpenDistance) {
          nestedTabTransX.value = withSpring(0, {
            velocity: 50,
            stiffness: 1000,
            damping: 500,
            mass: 3,
            overshootClamping: true,
            restDisplacementThreshold: 0.01,
            restSpeedThreshold: 0.01,
          });
        } else {
          resetNestedTabTransX();
        }
      }

      lastTransX.value = 0;
      native.enabled(true);
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      pan.enabled(true);
      lockDirection.value = LockDirection.None;
      setInnerDisableRefresh(disableRefresh);
      // restore the onPress function
      enableOnPressAnim.value = withTiming(1, { duration: 50 });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canOpenDrawer, lockDirection, tabIndex.value],
  );
  const pan = useMemo(() => {
    const basePan = Gesture.Pan()
      .onTouchesDown(({ allTouches }) => {
        nestedTabStartX.value = allTouches[0].absoluteX;
        startY.value = allTouches[0].absoluteY;
        offsetX.value = nestedTabTransX.value;
        lastTransX.value = 0;
        native.enabled(true);
        lockDirection.value = LockDirection.None;
        setInnerDisableRefresh(disableRefresh);
      })
      .onFinalize(onEnd);
    if (platformEnv.isNativeIOS) {
      // onUpdate works better on IOS
      basePan.onUpdate((e) => {
        // when fingers move,
        // disable the onPress function
        enableOnPressAnim.value = 0;
        if (canOpenDrawer && tabIndex.value === 0 && e.translationX > 0) {
          nestedTabTransX.value = offsetX.value + e.translationX;
          lastTransX.value = e.translationX;
        }
      });
    }
    if (platformEnv.isNativeAndroid) {
      // onTouchesMove works better on Android
      basePan.onTouchesMove(({ allTouches }) => {
        pan.enabled(true);
        native.enabled(true);
        // when fingers move,
        // disable the onPress function
        enableOnPressAnim.value = 0;
        if (lockDirection.value === LockDirection.Vertical) {
          return;
        }
        // use Math.max to ensure the translation always increase
        const transX = allTouches[0].absoluteX - nestedTabStartX.value;
        lastTransX.value = transX;

        if (lockDirection.value === LockDirection.None) {
          if (
            Math.abs(allTouches[0].absoluteY - startY.value) > failedDistance
          ) {
            lockDirection.value = LockDirection.Vertical;
            lastTransX.value = 0;
          }
          if (transX > failedDistance) {
            setInnerDisableRefresh(false);
            native.enabled(false);
            lockDirection.value = LockDirection.Horizontal;
          }
        }
        if (canOpenDrawer && tabIndex.value === 0 && transX > failedDistance) {
          nestedTabTransX.value = offsetX.value + transX;
        }
      });
    }
    return basePan;
  }, [
    canOpenDrawer,
    lastTransX,
    lockDirection,
    offsetX,
    onEnd,
    startY,
    tabIndex.value,
  ]);

  const onTabChange = useCallback(
    (e: NativeSyntheticEvent<{ tabName: string; index: number }>) => {
      tabIndex.value = e.nativeEvent.index;
      onChange?.(e);
    },
    [onChange, tabIndex],
  );
  const content = (
    <NativeNestedTabView
      defaultIndex={defaultIndex}
      onChange={onTabChange}
      scrollEnabled={scrollEnabled}
      disableRefresh={innerDisableRefresh}
      // @ts-ignore
      ref={tabRef}
      {...rest}
    >
      {renderHeader?.()}
      {children}
    </NativeNestedTabView>
  );
  return scrollEnabled ? (
    <GestureDetector
      gesture={
        platformEnv.isNativeAndroid
          ? Gesture.Exclusive(native, pan)
          : Gesture.Simultaneous(pan, native)
      }
    >
      {content}
    </GestureDetector>
  ) : (
    content
  );
};

export default forwardRef(NestedTabView);
