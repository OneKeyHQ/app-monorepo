import platformEnv from '../platformEnv';
import { wasNativeSettingsEmptyAtStartup } from '../storage/instance/nativeSyncStorageMirror';
import { travelModeManager } from '../travelMode';

export function isFreshInstallSync(): boolean {
  return (
    Boolean(platformEnv.isNativeMainThread) &&
    !travelModeManager.isMaskingDataSync() &&
    wasNativeSettingsEmptyAtStartup()
  );
}
