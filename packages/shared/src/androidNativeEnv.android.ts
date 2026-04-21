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
// relying on Nitro's throw-behavior contract and does not touch the
// HybridObject itself at detection time.
//
// This mirrors the APK flavor exactly, independent of the Metro-inlined
// `process.env.ANDROID_CHANNEL`, so the signal is still accurate for OTA
// bundles that inline 'direct' but are actually running in a Google Play
// APK.
interface INitroModulesLike {
  hasHybridObject?: (name: string) => boolean;
}

interface INativeLoggerLike {
  write?: (level: number, msg: string) => void;
}

// Write the detection outcome straight to the native-logger file so it is
// persisted offline before any higher-level logger scope is ready. Wrapped
// in try/catch + lazy require because this runs at module-evaluation time
// (before the JS runtime bootstrap finishes) and must never throw out of
// `detectAndroidChannel`.
function writeNativeLog(message: string): void {
  try {
    /* eslint-disable @typescript-eslint/no-var-requires, global-require */
    const mod = require('@onekeyfe/react-native-native-logger') as {
      NativeLogger?: INativeLoggerLike;
    };
    // LogLevel.Info = 1 — see packages/shared/src/modules3rdParty/react-native-file-logger
    mod?.NativeLogger?.write?.(1, message);
    /* eslint-enable */
  } catch {
    // Native-logger not ready yet — drop silently
  }
}

function detectAndroidChannel(): string {
  const inline = process.env.ANDROID_CHANNEL || 'direct';
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const mod = require('react-native-nitro-modules') as {
      NitroModules?: INitroModulesLike;
    };
    const nitro = mod?.NitroModules;
    if (typeof nitro?.hasHybridObject === 'function') {
      const hasAppUpdate = nitro.hasHybridObject('ReactNativeAppUpdate');
      const resolved = hasAppUpdate ? inline : 'google';
      writeNativeLog(
        `detectAndroidChannel: inline=${inline} hasReactNativeAppUpdate=${hasAppUpdate} resolved=${resolved}`,
      );
      return resolved;
    }
    writeNativeLog(
      `detectAndroidChannel: inline=${inline} nitroProbe=api-missing resolved=${inline}`,
    );
    return inline;
  } catch (error) {
    const message = (error as Error)?.message ?? String(error);
    writeNativeLog(
      `detectAndroidChannel: inline=${inline} nitroProbe=fail(${message}) resolved=${inline}`,
    );
    // Nitro itself failed to load — extremely unlikely because it is a
    // hard dependency. If it happens, fall back to the inline value
    // rather than falsely promoting every user to 'google'.
    return inline;
  }
}

export const ANDROID_CHANNEL = detectAndroidChannel();
