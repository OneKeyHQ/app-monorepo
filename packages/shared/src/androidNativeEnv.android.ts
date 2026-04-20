// Probe whether the @onekeyfe/react-native-app-update native module is
// linked by asking Nitro's HybridObjectRegistry directly.
//
// apps/mobile/android/app/build.gradle substitutes this module with the
// apps/mobile/android/app-update-noop stub on every non-`prod` Android
// flavor (i.e. the `google` flavor shipped to Google Play). The noop
// stub omits `System.loadLibrary("reactnativeappupdate")` and registers
// no Nitro HybridObject, so
//   NitroModules.hasHybridObject('ReactNativeAppUpdate')
// returns false on Google Play APKs and true on direct APKs.
//
// Using `hasHybridObject` — a documented, side-effect-free boolean query
// — rather than catching an exception from `createHybridObject` avoids
// relying on Nitro's throw-behaviour contract and does not touch the
// HybridObject itself at detection time.
//
// This mirrors the APK flavor exactly, independent of the Metro-inlined
// `process.env.ANDROID_CHANNEL`, so the signal is still accurate for OTA
// bundles that inline 'direct' but are actually running in a Google Play
// APK.
interface INitroModulesLike {
  hasHybridObject?: (name: string) => boolean;
}

function detectAndroidChannel(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const mod = require('react-native-nitro-modules') as {
      NitroModules?: INitroModulesLike;
    };
    const nitro = mod?.NitroModules;
    if (typeof nitro?.hasHybridObject === 'function') {
      return nitro.hasHybridObject('ReactNativeAppUpdate')
        ? process.env.ANDROID_CHANNEL || 'direct'
        : 'google';
    }
    return process.env.ANDROID_CHANNEL || 'direct';
  } catch {
    // Nitro itself failed to load — extremely unlikely because it is a
    // hard dependency. If it happens, fall back to the inline value
    // rather than falsely promoting every user to 'google'.
    return process.env.ANDROID_CHANNEL || 'direct';
  }
}

export const ANDROID_CHANNEL = detectAndroidChannel();
