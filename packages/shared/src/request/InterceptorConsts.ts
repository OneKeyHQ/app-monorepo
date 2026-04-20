import { getAndroidChannelSync } from '../androidNativeEnv';
import platformEnv from '../platformEnv';

// Be consistent with backend platform definition
// https://onekeyhq.atlassian.net/wiki/spaces/ONEKEY/pages/390266887#%E5%85%AC%E5%85%B1%E5%8F%82%E6%95%B0
const staticHeaderPlatform = [platformEnv.appPlatform, platformEnv.appChannel]
  .filter(Boolean)
  .join('-');

export function getHeaderPlatform(): string {
  // On Android, the Metro-inlined ANDROID_CHANNEL can be wrong for OTA
  // bundles (inlined as 'direct' but running on a Google Play APK). When
  // resolveAndroidChannel has completed, prefer its value so the server
  // receives the correct channel identifier.
  if (platformEnv.isNativeAndroid) {
    const resolved = getAndroidChannelSync();
    if (resolved === 'googlePlay') return 'android-googlePlay';
    if (resolved === 'apk' && platformEnv.appChannel !== 'apk') {
      return 'android-apk';
    }
  }
  return staticHeaderPlatform;
}

// Static snapshot kept for backwards compatibility. New code should prefer
// getHeaderPlatform() so OTA-bundle channel corrections propagate to network
// headers once the resolver resolves.
export const headerPlatform = staticHeaderPlatform;
