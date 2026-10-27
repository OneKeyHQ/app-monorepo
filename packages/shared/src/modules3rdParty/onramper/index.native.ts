import * as ExpoDevice from 'expo-device';

import platformEnv from '../../platformEnv';

import { createMockOnramperClient } from './mock';
import { createRealOnramperClient } from './realClient.native';

import type { ICreateOnramperClientParams, IOnramperClient } from './type';

export * from './type';
export * from './quotePricing';
export * from './orderStatus';
export * from './utils';
export { getOnramperConfig } from './credentials.native';
// Startup code must import the gate from './canUseHeadless' directly: this
// barrel carries the SDK client and the mock, which belong to the buy pages.
export { canUseHeadless } from './canUseHeadless.native';

export function createOnramperClient(
  params: ICreateOnramperClientParams,
): IOnramperClient {
  // Real SDK only on real iOS devices. Android has no OnramperReactNative
  // native module, so creating the real client there throws synchronously
  // during render (reachable via the dev Gallery, which bypasses
  // canUseHeadless); the Simulator has no App Attest. Both use the mock.
  // See ./NATIVE_SETUP.md.
  return platformEnv.isNativeIOS && ExpoDevice.isDevice
    ? createRealOnramperClient(params)
    : createMockOnramperClient(params);
}
