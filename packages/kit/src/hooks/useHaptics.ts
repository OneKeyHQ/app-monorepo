import * as Haptics from 'expo-haptics';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function useHaptics() {
  if (platformEnv.isAndroid || platformEnv.isIOS) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}
