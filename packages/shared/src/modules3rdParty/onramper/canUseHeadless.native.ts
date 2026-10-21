import * as ExpoDevice from 'expo-device';
import { Platform } from 'react-native';

import platformEnv from '../../platformEnv';

import { hasOnramperCredentials } from './credentials.native';

// Standalone module: this gate is called from Home startup code (every buy
// entry), so it must not pull the SDK-backed client or the mock in with it.
// Everything else Onramper stays behind the lazily loaded buy pages.

// Minimum iOS version the Onramper Headless SDK supports — its pod spec pins
// `:ios => '16.0'`. The app deployment target matches (16.0), so this guard
// only matters if that floor ever diverges again.
const ONRAMPER_MIN_IOS = 16;

export function canUseHeadless(): boolean {
  if (!platformEnv.isNativeIOS) {
    return false;
  }
  // A build flavor without its credentials pair (production until the
  // post-KYB key lands) must stay on the web widget — the real client throws
  // at creation when credentials are missing.
  if (!hasOnramperCredentials()) {
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
