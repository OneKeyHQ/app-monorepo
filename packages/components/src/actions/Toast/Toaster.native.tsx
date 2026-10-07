import { useCallback, useMemo } from 'react';

import { Toasts } from '@backpackapp-io/react-native-toast';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { TOAST_Z_INDEX } from '@onekeyhq/shared/src/utils/overlayUtils';

import { useReanimatedKeyboardAnimation } from '../../hooks/useKeyboardController';
import { useSafeAreaInsets } from '../../hooks/useLayout';
import { usableWindowBottom } from '../../utils/usableWindowBottom';

import {
  TOAST_ROOM,
  TOAST_SHIFT_MS,
  toastShiftUnderObstruction,
  useToastTopObstruction,
} from './topObstruction';

import type { LayoutChangeEvent } from 'react-native';

// The library seats its first toast this far under the top inset.
const TOASTS_TOP_PAD = 16;
// One element for every render: a shift re-renders this wrapper only, and
// React bails out of the library's list on the identical child.
const toasts = <Toasts />;
// The app's toast overlay owns iOS native window ordering; elsewhere the
// z-index keeps the toasts over everything.
const wrapperBaseStyle = platformEnv.isNativeIOS
  ? StyleSheet.absoluteFill
  : [StyleSheet.absoluteFill, { zIndex: TOAST_Z_INDEX }];
const isAndroid = Boolean(platformEnv.isNativeAndroid);

// The hardware stage hangs from the top, where the toasts land: while it
// is up the whole toaster rides down to rest under its bottom edge (see
// topObstruction), and back when it leaves — a toast already on show when
// the stage arrives moves with it, so neither covers the other. The ride
// stops at the window's usable bottom edge (the keyboard's top while it is
// up): under a card that leaves no room the toast overlaps the card's
// foot instead of leaving the screen. A transform on a wrapper, so the
// library's own layout never re-runs.
function ToastContainer() {
  const { top, bottom } = useSafeAreaInsets();
  const obstruction = useToastTopObstruction();
  const reducedMotion = useReducedMotion();
  const { height: keyboardHeight } = useReanimatedKeyboardAnimation();
  // The wrapper fills the window on every platform, so its own height is
  // the window's — whatever the platform's window metrics call one.
  const windowHeight = useSharedValue(0);
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      windowHeight.value = event.nativeEvent.layout.height;
    },
    [windowHeight],
  );
  const toastTop = top + TOASTS_TOP_PAD;
  const shiftStyle = useAnimatedStyle(() => {
    const maxToastTop =
      windowHeight.value > 0
        ? usableWindowBottom(
            windowHeight.value,
            bottom,
            Math.abs(keyboardHeight.value),
            isAndroid,
          ) - TOAST_ROOM
        : Number.POSITIVE_INFINITY;
    const shift = toastShiftUnderObstruction(
      obstruction,
      toastTop,
      maxToastTop,
    );
    return {
      transform: [
        {
          translateY: reducedMotion
            ? shift
            : withTiming(shift, { duration: TOAST_SHIFT_MS }),
        },
      ],
    };
  }, [
    bottom,
    keyboardHeight,
    obstruction,
    reducedMotion,
    toastTop,
    windowHeight,
  ]);
  const style = useMemo(() => [wrapperBaseStyle, shiftStyle], [shiftStyle]);
  return (
    // collapsable={false}: Fabric flattens a layout-only box-none view out
    // of the native tree, and the transform would go with it.
    <Animated.View
      style={style}
      pointerEvents="box-none"
      collapsable={false}
      onLayout={handleLayout}
    >
      {toasts}
    </Animated.View>
  );
}

export default ToastContainer;
