/* eslint-disable @typescript-eslint/no-use-before-define */
import type { ForwardRefRenderFunction } from 'react';
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';

import { UIManager, findNodeHandle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue, withTiming } from 'react-native-reanimated';

import { useIsVerticalLayout } from '@onekeyhq/components';
import { enableOnPressAnim } from '@onekeyhq/components/src/utils/useBeforeOnPress';
import { useNavigationActions } from '@onekeyhq/kit/src/hooks';
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

const NestedTabView: ForwardRefRenderFunction<
  ForwardRefHandle,
  NestedTabViewProps
> = (
  {
    renderHeader,
    children,
    onChange,
    defaultIndex,
    scrollEnabled = true,
    ...rest
  },
  ref,
) => {
  const isVerticalLayout = useIsVerticalLayout();
  const canOpenDrawer = rest.canOpenDrawer && isVerticalLayout;
  const { openDrawer } = useNavigationActions();
  const tabRef = useRef<typeof NativeNestedTabView>(null);
  // const { width: screenWidth } = useWindowDimensions();
  const tabIndex = useSharedValue(defaultIndex);
  const offsetX = useSharedValue(0);
  const lockDirection = useSharedValue(LockDirection.None);

  // only used on android cause touchMove event does not have translation values
  const lastTransX = useSharedValue(0);
  const startY = useSharedValue(0);
  const native = Gesture.Native();

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
      lockDirection.value = LockDirection.Horizontal;
    }
  }, [lockDirection]);

  const resetGesture = useCallback(() => {
    if (platformEnv.isNativeAndroid) {
      // console.log('resetGesture');
      lastTransX.value = 0;
      lockDirection.value = LockDirection.None;
      pan.enabled(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastTransX, lockDirection]);

  const setPageIndex = useCallback((pageIndex: number) => {
    try {
      UIManager.dispatchViewManagerCommand(
        findNodeHandle(tabRef.current),
        getViewManagerConfig().Commands.setPageIndex,
        [pageIndex],
      );
    } catch (error) {
      debugLogger.common.error(`switch account tab error`, error);
    }
  }, []);

  useImperativeHandle(ref, () => ({
    setPageIndex,
  }));

  const onEnd = useCallback(
    ({ translationX }) => {
      if (canOpenDrawer) {
        if (tabIndex.value === 0) {
          if (translationX > drawerOpenDistance) {
            openDrawer();
            // nestedTabTransX.value = withSpring(0, {
            //   velocity: 50,
            //   stiffness: 1000,
            //   damping: 500,
            //   mass: 3,
            //   overshootClamping: true,
            //   restDisplacementThreshold: 0.01,
            //   restSpeedThreshold: 0.01,
            // });
          } else {
            resetNestedTabTransX();
          }
        }
        resetGesture();
      }

      // restore the onPress function
      enableOnPressAnim.value = withTiming(1, { duration: 100 });
    },
    [canOpenDrawer, resetGesture, tabIndex, openDrawer],
  );
  const pan = useMemo(() => {
    const basePan = Gesture.Pan();
    if (canOpenDrawer) {
      basePan.onTouchesDown(({ allTouches }) => {
        resetGesture();
        nestedTabStartX.value = allTouches[0].absoluteX;
        startY.value = allTouches[0].absoluteY;
        offsetX.value = nestedTabTransX.value;
      });
    }
    if (platformEnv.isNativeIOS) {
      // onUpdate works better on IOS
      basePan.onUpdate((e) => {
        // console.log('update', e);
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
            lockVertical();
          }
          if (Math.abs(transX) > failedDistance) {
            lockHorizontal();
          }
        }
        if (canOpenDrawer && tabIndex.value === 0 && transX > failedDistance) {
          nestedTabTransX.value = offsetX.value + transX;
        }
      });
    }
    return basePan.onFinalize(onEnd);
  }, [
    canOpenDrawer,
    lastTransX,
    lockDirection,
    lockHorizontal,
    lockVertical,
    offsetX,
    onEnd,
    resetGesture,
    startY,
    tabIndex,
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
      // @ts-ignore
      ref={tabRef}
      {...rest}
    >
      {renderHeader?.()}
      {children}
    </NativeNestedTabView>
  );

  return (
    <GestureDetector
      gesture={
        // eslint-disable-next-line no-nested-ternary
        platformEnv.isNativeAndroid
          ? Gesture.Exclusive(native, pan)
          : canOpenDrawer
          ? Gesture.Simultaneous(native, pan)
          : // to solve ios system back gesture conflict
            // in tab pages without drawer
            Gesture.Race(native, pan)
      }
    >
      {content}
    </GestureDetector>
  );
};

export default forwardRef(NestedTabView);
