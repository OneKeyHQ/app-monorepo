import platformEnv from '../platformEnv';

import {
  acknowledgeTravelModeRuntimeLaunch,
  isTravelModeRuntimeLaunchNativeModuleAvailable,
} from './nativeLaunchEpoch';

import type { TravelModeManager } from './TravelModeManager';

export async function completeTravelModeRuntimeLaunchAcknowledgement(
  manager: Pick<TravelModeManager, 'getRuntimeProfile' | 'markRestartFailed'>,
): Promise<boolean> {
  if (!platformEnv.isNative || !platformEnv.nativeRuntimeKind) {
    return true;
  }
  try {
    const profile = await manager.getRuntimeProfile();
    if (!isTravelModeRuntimeLaunchNativeModuleAvailable()) {
      if (profile.kind === 'standard') {
        return true;
      }
      manager.markRestartFailed();
      return false;
    }
    await acknowledgeTravelModeRuntimeLaunch({
      profile: profile.kind,
      runtime: platformEnv.nativeRuntimeKind,
    });
    return true;
  } catch {
    manager.markRestartFailed();
    return false;
  }
}
