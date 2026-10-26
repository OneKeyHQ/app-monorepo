import { OneKeyLocalError } from '../errors';

import type { ITravelModeRuntimeProfile } from './runtimeProfile';

export type ITravelModeNativeRuntime = 'background' | 'main';
export type ITravelModeLaunchProfile = ITravelModeRuntimeProfile['kind'];

export type ITravelModeLaunchAcknowledgement = {
  epoch: number;
  status: 'complete' | 'idle';
};

export function isTravelModeRuntimeLaunchNativeModuleAvailable(): boolean {
  return false;
}

export async function prepareTravelModeRuntimeRestart(
  _profile: ITravelModeLaunchProfile,
): Promise<number> {
  throw new OneKeyLocalError('Unknown error');
}

export async function forceDisableTravelModeForRecovery(): Promise<boolean> {
  throw new OneKeyLocalError('Unknown error');
}

export async function acknowledgeTravelModeRuntimeLaunch(_params: {
  profile: ITravelModeLaunchProfile;
  runtime: ITravelModeNativeRuntime;
}): Promise<ITravelModeLaunchAcknowledgement> {
  throw new OneKeyLocalError('Unknown error');
}
