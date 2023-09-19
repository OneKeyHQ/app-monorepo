import { useCallback } from 'react';

import { makeMutable } from 'react-native-reanimated';

import { doHapticsWhenEnabled } from '@onekeyhq/shared/src/haptics';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { GestureResponderEvent } from 'react-native';

// to disable onPress when conflict with other gestures
export const enableOnPressAnim = makeMutable(1);

export const useBeforeOnPress = (onPress?: ((e: any) => void) | null) =>
  useCallback(
    (e: GestureResponderEvent | MouseEvent) => {
      if (!platformEnv.isNative) {
        const { autoHideSelectFunc } =
          require('./SelectAutoHide') as typeof import('./SelectAutoHide');
        autoHideSelectFunc(e as MouseEvent);
      }
      // console.log('beforeOnPress', enableOnPressAnim.value);
      if (enableOnPressAnim.value === 1 && onPress) {
        doHapticsWhenEnabled();

        onPress(e);
      }
    },
    [onPress],
  );
