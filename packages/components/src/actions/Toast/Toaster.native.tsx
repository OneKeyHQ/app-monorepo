import { useMemo } from 'react';

import { Toasts } from '@backpackapp-io/react-native-toast';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { TOAST_Z_INDEX } from '@onekeyhq/shared/src/utils/overlayUtils';

import { useSafeAreaInsets } from '../../hooks/useLayout';

import {
  TOAST_SHIFT_MS,
  toastShiftUnderObstruction,
  useToastTopObstruction,
} from './topObstruction';

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

// The hardware stage hangs from the top, where the toasts land: while it
// is up the whole toaster rides down to rest under its bottom edge (see
// topObstruction), and back when it leaves — a toast already on show when
// the stage arrives moves with it, so neither covers the other. A
// transform on a wrapper, so the library's own layout never re-runs.
function ToastContainer() {
  const { top } = useSafeAreaInsets();
  const shift = toastShiftUnderObstruction(
    useToastTopObstruction(),
    top + TOASTS_TOP_PAD,
  );
  const shiftStyle = useAnimatedStyle(
    () => ({
      transform: [
        { translateY: withTiming(shift, { duration: TOAST_SHIFT_MS }) },
      ],
    }),
    [shift],
  );
  const style = useMemo(() => [wrapperBaseStyle, shiftStyle], [shiftStyle]);
  return (
    // collapsable={false}: Fabric flattens a layout-only box-none view out
    // of the native tree, and the transform would go with it.
    <Animated.View style={style} pointerEvents="box-none" collapsable={false}>
      {toasts}
    </Animated.View>
  );
}

export default ToastContainer;
