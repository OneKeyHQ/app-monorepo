import { ReactNativeDeviceUtils } from '@onekeyfe/react-native-device-utils';

import { ESkanMilestone, SKAN_COARSE_RULE } from './types';

import type { ISkanConversion } from './types';

export { ESkanMilestone, SKAN_COARSE_RULE } from './types';

const APP_OPENED_THROTTLE_MS = 60 * 60 * 1000;

// Per JS runtime: main and bg each keep their own copy, which only means an
// extra submission at most. The native store merges and orders every call.
let lastAppOpenedAt = 0;

export const markSkanMilestones: ISkanConversion['markSkanMilestones'] = async (
  ...milestones
) => {
  // An OTA bundle can run on a native shell whose DeviceUtils predates SKAN.
  if (typeof ReactNativeDeviceUtils.markSkanMilestones !== 'function') {
    return;
  }
  const bits = milestones.reduce<number>(
    (merged, milestone) => merged | milestone,
    0,
  );
  try {
    await ReactNativeDeviceUtils.markSkanMilestones(bits, SKAN_COARSE_RULE);
  } catch (error) {
    // Rejects after the last conversion window closes or while a timed-out
    // submission is pending. The native store keeps the bits for the next
    // call, so attribution must never fail the caller.
    console.warn(
      '[SkanConversion] Conversion value update failed',
      error instanceof Error ? error.message : 'unknown_error',
    );
  }
};

export const markSkanAppOpened: ISkanConversion['markSkanAppOpened'] = () => {
  const now = Date.now();
  if (lastAppOpenedAt && now - lastAppOpenedAt < APP_OPENED_THROTTLE_MS) {
    return Promise.resolve();
  }
  lastAppOpenedAt = now;
  return markSkanMilestones(ESkanMilestone.AppOpened);
};
