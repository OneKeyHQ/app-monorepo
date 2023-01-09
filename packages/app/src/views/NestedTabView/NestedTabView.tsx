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

import NativeNestedTabView from './NativeNestedTabView';
import { nestedTabStartX, nestedTabTransX } from './types';

import type { NestedTabViewProps } from './types';
import type { NativeSyntheticEvent } from 'react-native';

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
  const lastTransX = useSharedValue(0);
  const [native, pan] = useMemo(
    () =>
      // the gesture order on android is:
      // finger down ->  native down
      //                 pan down
      //                 tap down
      // longer than 300ms -> tap onFinalize
      // finger move -> native onFinalize
      //                pan move
      //                tap cancel
      // finger up -> pan up
      //              pan onEnd
      //              pan onFinalize
      [
        Gesture.Native(),
        Gesture.Pan()
          .onStart((e) => {
            nestedTabStartX.value = e.x;
            lastTransX.value = nestedTabTransX.value;
            // enable onPress when fingers down
            enableOnPressAnim.value = 1;
          })
          .onUpdate((e) => {
            // when fingers move,
            // disable the onPress function
            enableOnPressAnim.value = 0;
            if (canOpenDrawer && tabIndex.value === 0 && e.translationX > 0) {
              nestedTabTransX.value = lastTransX.value + e.translationX;
            }
          })
          .onFinalize(() => {
            enableOnPressAnim.value = withTiming(1, { duration: 50 });
          })
          .onEnd((e) => {
            if (
              canOpenDrawer &&
              tabIndex.value === 0 &&
              nestedTabTransX.value > lastTransX.value
            ) {
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
            enableOnPressAnim.value = withTiming(1, { duration: 50 });
          }),
      ],
    [canOpenDrawer, lastTransX, tabIndex],
  );
  const onTabChange = useCallback(
    (e: NativeSyntheticEvent<{ tabName: string; index: number }>) => {
      tabIndex.value = e.nativeEvent.index;
      onChange?.(e);
    },
    [onChange, tabIndex],
  );
  return (
    <GestureDetector gesture={Gesture.Simultaneous(pan, native)}>
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
