import JPush from 'jpush-react-native';

import platformEnv from '../platformEnv';
import { setNativeTravelModePushSuppressed } from '../storage/nativeStorageMigrationModule';

export async function setTravelModePushSuppressed(
  suppressed: boolean,
): Promise<void> {
  if (platformEnv.isNativeIOS) {
    await setNativeTravelModePushSuppressed(suppressed);
    return;
  }
  if (suppressed) {
    JPush.stopPush();
    return;
  }
  JPush.resumePush();
}
