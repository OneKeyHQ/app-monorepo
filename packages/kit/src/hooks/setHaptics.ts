import * as Haptics from 'expo-haptics';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function setHaptics() {
  if (platformEnv.isAndroid || platformEnv.isIOS)
    return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}
