import {
  NativeEventEmitter,
  NativeModules,
  TurboModuleRegistry,
} from 'react-native';

import platformEnv from '../platformEnv';

type INetInfoState = { type?: unknown } | undefined;

type INetInfoModule = {
  // Required on purpose: TurboModule calls must pass the declared argument
  // count. A zero-argument call shifts the promise blocks on iOS (crash on
  // the main queue) and throws an argument-count error on Android.
  getCurrentState: (
    requestedInterface: string | undefined,
  ) => Promise<INetInfoState>;
  addListener: (eventName: string) => void;
  removeListeners: (count: number) => void;
};

// Per JS runtime: native main and background each subscribe separately.
let networkType: unknown;
let started = false;

/**
 * Reads the RNCNetInfo native module directly: the NetInfo JS singleton would
 * start reachability pings and share configuration with NetworkDoctor. Only
 * `type` is read, never `details` (carrier, SSID, IP).
 */
export function startAvailabilityNetworkTypeTracking() {
  if (started || platformEnv.isJest) return;
  started = true;
  try {
    const netInfo = (TurboModuleRegistry.get('RNCNetInfo') ??
      NativeModules.RNCNetInfo) as INetInfoModule | null | undefined;
    if (!netInfo) return;
    new NativeEventEmitter(netInfo).addListener(
      'netInfo.networkStatusDidChange',
      (state: INetInfoState) => {
        networkType = state?.type;
      },
    );
    void netInfo.getCurrentState(undefined).then(
      (state) => {
        // A change event that arrived first is newer than this seed.
        networkType ??= state?.type;
      },
      () => undefined,
    );
  } catch {
    // Network type stays unknown.
  }
}

/** Raw NetInfo connection type, or undefined before the first read. */
export function getAvailabilityNetworkType(): unknown {
  return networkType;
}
