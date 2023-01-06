import { makeMutable } from 'react-native-reanimated';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { GestureResponderEvent } from 'react-native';

export const enableOnPressAnim = makeMutable(1);
export const beforeOnPress = (
  e: GestureResponderEvent | MouseEvent,
  onPress?: ((e: any) => void) | null,
) => {
  if (platformEnv.isRuntimeBrowser) {
    const { autoHideSelectFunc } =
      require('./SelectAutoHide') as typeof import('./SelectAutoHide');
    autoHideSelectFunc(e as MouseEvent);
  }
  // console.log('beforeOnPress', enableOnPressAnim.value);
  if (enableOnPressAnim.value === 1) {
    onPress?.(e);
  }
};
