import {
  NativeEventEmitter,
  NativeModules,
  TurboModuleRegistry,
} from 'react-native';

import platformEnv from '../platformEnv';

import { normalizeAvailabilityConnectionType } from './availabilityNetworkTypeUtils';

import type { IAvailabilityNetworkType } from './availabilityNetworkTypeUtils';

export type { IAvailabilityNetworkType } from './availabilityNetworkTypeUtils';

const NET_INFO_CHANGE_EVENT = 'netInfo.networkStatusDidChange';

type INetInfoNativeState = { type?: unknown };

type INetInfoNativeModule = {
  // Required on purpose: TurboModule calls must pass the declared argument
  // count. A zero-argument call shifts the promise blocks on iOS (crash on
  // the main queue) and throws an argument-count error on Android.
  getCurrentState: (
    requestedInterface: string | undefined,
  ) => Promise<INetInfoNativeState>;
  addListener: (eventName: string) => void;
  removeListeners: (count: number) => void;
};

// One cache per JS runtime: native main and background each subscribe to
// their own RNCNetInfo module instance and start as `unknown`.
let cachedNetworkType: IAvailabilityNetworkType = 'unknown';
let trackingStarted = false;
let changeEventSequence = 0;

function getNetInfoNativeModule(): INetInfoNativeModule | undefined {
  return (
    (TurboModuleRegistry.get('RNCNetInfo') as INetInfoNativeModule | null) ??
    (NativeModules.RNCNetInfo as INetInfoNativeModule | undefined) ??
    undefined
  );
}

/**
 * Talks to the RNCNetInfo native module directly instead of the NetInfo JS
 * singleton: the singleton starts permanent internet reachability pings on
 * iOS and its global configure() would change NetworkDoctor behavior. Only
 * `type` is projected; `details` (carrier, SSID, IP) is never read or kept.
 */
export function startAvailabilityNetworkTypeTracking() {
  if (trackingStarted || platformEnv.isJest) return;
  trackingStarted = true;
  try {
    const nativeModule = getNetInfoNativeModule();
    if (!nativeModule) return;
    new NativeEventEmitter(nativeModule).addListener(
      NET_INFO_CHANGE_EVENT,
      (state: INetInfoNativeState | undefined) => {
        changeEventSequence += 1;
        cachedNetworkType = normalizeAvailabilityConnectionType(state?.type);
      },
    );
    const sequenceAtSeed = changeEventSequence;
    // Same call shape as NetInfo itself: an explicit undefined interface.
    void nativeModule
      .getCurrentState(undefined)
      .then((state) => {
        // A change event that arrived first is newer than this seed.
        if (sequenceAtSeed === changeEventSequence) {
          cachedNetworkType = normalizeAvailabilityConnectionType(state?.type);
        }
      })
      .catch(() => undefined);
  } catch {
    // Network type stays unknown when the module is unavailable.
  }
}

export function getAvailabilityNetworkType(): IAvailabilityNetworkType {
  return cachedNetworkType;
}
