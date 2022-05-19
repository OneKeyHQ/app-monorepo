import * as Haptics from 'expo-haptics';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function setHaptics() {
  if (platformEnv.isNativeAndroid || platformEnv.isNativeIOS)
    return Haptics.selectionAsync();
}
