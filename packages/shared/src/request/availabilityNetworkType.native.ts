import {
  NativeEventEmitter,
  NativeModules,
  TurboModuleRegistry,
} from 'react-native';

import { defaultLogger } from '../logger/logger';
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

// The module can register after the first counted request, so tracking is
// re-attempted. Both the count and the spacing are bounded: a module that
// never appears costs two number comparisons per request rather than a lookup,
// and no state is latched on an unsettled promise, so nothing can wedge.
const MAX_TRACKING_ATTEMPTS = 8;
const TRACKING_RETRY_GAP_MS = 5000;

// Per JS runtime: native main and background each subscribe separately.
let networkType: unknown;
let subscribed = false;
let attempts = 0;
let lastAttemptAt = 0;
const reportedReasons = new Set<string>();

/** Reports each give-up path once, so a dead tracker is visible on device. */
function reportUnread(reason: string) {
  if (reportedReasons.has(reason)) return;
  reportedReasons.add(reason);
  try {
    defaultLogger.app.network.availabilityNetworkType(reason);
  } catch {
    // Diagnostics must never affect requests.
  }
}

function resolveNetInfoModule() {
  try {
    return (TurboModuleRegistry.get('RNCNetInfo') ??
      NativeModules.RNCNetInfo) as INetInfoModule | null | undefined;
  } catch {
    return undefined;
  }
}

/**
 * Reads the RNCNetInfo native module directly: the NetInfo JS singleton would
 * start reachability pings and share configuration with NetworkDoctor. Only
 * `type` is read, never `details` (carrier, SSID, IP).
 *
 * Called on every counted request. It stops as soon as a type is known; until
 * then it re-attempts, because a single silent failure used to leave
 * `api_net` unreadable for the life of the runtime. Nothing is latched on a
 * promise, so a native call that never settles delays the next attempt rather
 * than cancelling it.
 */
export function startAvailabilityNetworkTypeTracking() {
  if (platformEnv.isJest) return;
  if (networkType !== undefined || attempts >= MAX_TRACKING_ATTEMPTS) return;
  const now = Date.now();
  if (attempts > 0 && now - lastAttemptAt < TRACKING_RETRY_GAP_MS) return;
  attempts += 1;
  lastAttemptAt = now;

  const netInfo = resolveNetInfoModule();
  if (!netInfo) {
    // Not latched: a module that registers late is picked up by a later call.
    reportUnread('module');
    return;
  }

  if (!subscribed) {
    // Subscribed only once the module resolved, so an early request cannot
    // disable tracking for the rest of the runtime's life, and a retry cannot
    // add a second listener.
    subscribed = true;
    // Its own try: an emitter failure must not skip the seed below, which is
    // the only path that yields a type when no change event ever arrives.
    try {
      new NativeEventEmitter(netInfo).addListener(
        'netInfo.networkStatusDidChange',
        (state: INetInfoState) => {
          networkType = state?.type;
        },
      );
    } catch {
      reportUnread('emitter');
    }
  }

  try {
    void netInfo.getCurrentState(undefined).then(
      (state) => {
        // A change event that arrived first is newer than this seed.
        networkType ??= state?.type;
        if (networkType === undefined) reportUnread('seedEmpty');
      },
      () => reportUnread('seedRejected'),
    );
  } catch {
    reportUnread('seedThrew');
  }
}

/** Raw NetInfo connection type, or undefined before the first read. */
export function getAvailabilityNetworkType(): unknown {
  return networkType;
}
