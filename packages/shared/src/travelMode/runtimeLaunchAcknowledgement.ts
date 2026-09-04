import platformEnv from '../platformEnv';

import { acknowledgeTravelModeRuntimeLaunch } from './nativeLaunchEpoch';

import type { TravelModeManager } from './TravelModeManager';

export async function completeTravelModeRuntimeLaunchAcknowledgement(
  manager: TravelModeManager,
): Promise<boolean> {
  if (!platformEnv.isNative || !platformEnv.nativeRuntimeKind) {
    return true;
  }
  try {
    const profile = await manager.getRuntimeProfile();
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
