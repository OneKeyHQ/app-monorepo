import type { ForwardRefRenderFunction } from 'react';
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
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
import { nestedTabStartX, nestedTabTransX } from './types';

import type { NestedTabViewProps } from './types';
import type { NativeSyntheticEvent } from 'react-native';
import type { PanGestureHandlerEventPayload } from 'react-native-gesture-handler';

export type ForwardRefHandle = {
  setPageIndex: (pageIndex: number) => void;
};

const failOffsetY = 10;
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
    ...rest
  },
  ref,
) => {
  const tabRef = useRef<typeof NativeNestedTabView>(null);
  // const { width: screenWidth } = useWindowDimensions();
  const tabIndex = useSharedValue(defaultIndex);
  const offsetX = useSharedValue(0);

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
    ({ translationX, translationY }: PanGestureHandlerEventPayload) => {
      if (
        canOpenDrawer &&
        tabIndex.value === 0 &&
        translationX > 0 &&
        translationY < failOffsetY
      ) {
        nestedTabTransX.value = withSpring(0, {
          velocity: 50,
          stiffness: 1000,
          damping: 500,
          mass: 3,
          overshootClamping: true,
          restDisplacementThreshold: 0.01,
          restSpeedThreshold: 0.01,
        });
      }
      // restore the onPress function
      enableOnPressAnim.value = withTiming(1, { duration: 50 });
    },
    [canOpenDrawer, tabIndex],
  );
  const pan = useMemo(() => {
    const basePan = Gesture.Pan().onTouchesDown(({ allTouches }) => {
      nestedTabStartX.value = allTouches[0].x;
      startY.value = allTouches[0].y;
      offsetX.value = nestedTabTransX.value;
      lastTransX.value = 0;
      // enable onPress when fingers down
      enableOnPressAnim.value = 1;
    });
    if (platformEnv.isNativeIOS) {
      // onUpdate works better on IOS
      basePan
        .onUpdate((e) => {
          // when fingers move,
          // disable the onPress function
          enableOnPressAnim.value = 0;
          if (canOpenDrawer && tabIndex.value === 0 && e.translationX > 0) {
            nestedTabTransX.value = offsetX.value + e.translationX;
          }
        })
        .onEnd(onEnd);
    }
    if (platformEnv.isNativeAndroid) {
      // onTouchesMove works better on Android
      basePan
        .onTouchesMove(({ allTouches }) => {
          // use Math.max to ensure the translation always increase
          const transX = Math.max(
            lastTransX.value,
            allTouches[0].x - nestedTabStartX.value,
          );
          lastTransX.value = transX;

          if (
            canOpenDrawer &&
            tabIndex.value === 0 &&
            transX > 0 &&
            // cancel swipe if scroll vertically
            Math.abs(allTouches[0].y - startY.value) < failOffsetY
          ) {
            nestedTabTransX.value = offsetX.value + transX;
          }
          // when fingers move,
          // disable the onPress function
          enableOnPressAnim.value = 0;
        })
        .onFinalize(onEnd);
    }
    return basePan;
  }, [canOpenDrawer, lastTransX, offsetX, onEnd, startY, tabIndex]);

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
