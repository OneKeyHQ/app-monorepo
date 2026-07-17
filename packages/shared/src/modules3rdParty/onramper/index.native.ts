import * as ExpoDevice from 'expo-device';
import { Platform } from 'react-native';

import platformEnv from '../../platformEnv';

import { createMockOnramperClient } from './mock';
import { createRealOnramperClient } from './realClient.native';

import type { ICreateOnramperClientParams, IOnramperClient } from './type';

export * from './type';
export * from './utils';
export { getOnramperConfig } from './realClient.native';

// Minimum iOS version the Onramper Headless SDK supports. Plan open question #4 —
// confirm the exact floor with Onramper before shipping.
const ONRAMPER_MIN_IOS = 16;

export function canUseHeadless(): boolean {
  if (!platformEnv.isNativeIOS) {
    return false;
  }
  const iosVersion = parseInt(String(Platform.Version), 10);
  if (Number.isNaN(iosVersion) || iosVersion < ONRAMPER_MIN_IOS) {
    return false;
  }
  // App Attest requires a real device; allow the Simulator only in dev builds so
  // the mock-backed UI stays reviewable without a device.
  return ExpoDevice.isDevice || Boolean(platformEnv.isDev);
}

export function createOnramperClient(
  params: ICreateOnramperClientParams,
): IOnramperClient {
  // Real SDK on real devices; the Simulator has no App Attest so it always uses
  // the mock. See ./NATIVE_SETUP.md.
  return ExpoDevice.isDevice
    ? createRealOnramperClient(params)
    : createMockOnramperClient(params);
}
