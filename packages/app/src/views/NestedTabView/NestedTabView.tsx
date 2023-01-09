import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

// import { useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { enableOnPressAnim } from '@onekeyhq/components/src/utils/beforeOnPress';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import NativeNestedTabView from './NativeNestedTabView';
import { nestedTabStartX, nestedTabTransX } from './types';

import type { NestedTabViewProps } from './types';
import type { NativeSyntheticEvent } from 'react-native';
import type {
  GestureStateChangeEvent,
  PanGestureHandlerEventPayload,
} from 'react-native-gesture-handler';

const native = Gesture.Native();
const NestedTabView: FC<NestedTabViewProps> = ({
  renderHeader,
  children,
  onChange,
  defaultIndex,
  canOpenDrawer,
  ...rest
}) => {
  // const { width: screenWidth } = useWindowDimensions();
  const tabIndex = useSharedValue(defaultIndex);
  const offsetX = useSharedValue(0);
  const lastTransX = useSharedValue(0);
  const onEnd = useCallback(
    (e: PanGestureHandlerEventPayload) => {
      if (canOpenDrawer && tabIndex.value === 0 && e.translationX > 0) {
        nestedTabTransX.value = withSpring(0, {
          velocity: e.velocityX,
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
    const basePan = Gesture.Pan().onTouchesDown((e) => {
      nestedTabStartX.value = e.allTouches[0].x;
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
        .onTouchesMove((e) => {
          // use Math.max to ensure the translation always increase
          const transX = Math.max(
            lastTransX.value,
            e.allTouches[0].x - nestedTabStartX.value,
          );
          lastTransX.value = transX;
          if (canOpenDrawer && tabIndex.value === 0 && transX > 0) {
            nestedTabTransX.value = offsetX.value + transX;
          }
          // when fingers move,
          // disable the onPress function
          enableOnPressAnim.value = 0;
        })
        .onFinalize(onEnd);
    }
    return basePan;
  }, [canOpenDrawer, lastTransX, offsetX, onEnd, tabIndex]);

  const onTabChange = useCallback(
    (e: NativeSyntheticEvent<{ tabName: string; index: number }>) => {
      tabIndex.value = e.nativeEvent.index;
      onChange?.(e);
    },
    [onChange, tabIndex],
  );
  return (
    <GestureDetector
      gesture={
        platformEnv.isNativeAndroid
          ? Gesture.Exclusive(native, pan)
          : Gesture.Simultaneous(pan, native)
      }
    >
      <NativeNestedTabView
        defaultIndex={defaultIndex}
        onChange={onTabChange}
        {...rest}
      >
        {renderHeader?.()}
        {children}
      </NativeNestedTabView>
    </GestureDetector>
  );
};

export default NestedTabView;
