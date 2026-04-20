// Probe whether the @onekeyfe/react-native-app-update native module is
// linked. apps/mobile/android/app/build.gradle substitutes it with
// apps/mobile/android/app-update-noop on every non-`prod` Android flavor
// (i.e. the `google` flavor shipped to Google Play). The noop stub
// registers no Nitro HybridObject for 'ReactNativeAppUpdate', so loading
// the JS package throws synchronously inside
// `NitroModules.createHybridObject('ReactNativeAppUpdate')`.
//
// This mirrors the APK flavor exactly, independent of the Metro-inlined
// `process.env.ANDROID_CHANNEL`, so the signal is still accurate for OTA
// bundles that inline 'direct' but are actually running in a Google Play
// APK.
function detectAndroidChannel(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    require('@onekeyfe/react-native-app-update');
    return process.env.ANDROID_CHANNEL || 'direct';
  } catch {
    return 'google';
  }
}

export const ANDROID_CHANNEL = detectAndroidChannel();
