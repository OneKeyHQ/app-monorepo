import { NativeModules, TurboModuleRegistry } from 'react-native';

import platformEnv from '../../platformEnv';

const PLUGIN_NATIVE_MODULE_NAME = 'PosthogReactNativePlugin';

type IPluginStopModule = {
  stopRecording?: () => Promise<void>;
};

let stopPromise: Promise<void> | undefined;

// iOS in-app restarts (clear data, language, Travel Mode, OTA) reload JS in
// the same process, and the native SDK keeps recording for the previous
// context. Called once per JS context as early as possible in `main`, without
// loading the plugin JS and without waiting for the analytics bootstrap.
export function stopLeftoverNativeReplay(): Promise<void> {
  stopPromise ??= (async () => {
    if (!platformEnv.isNativeMainThread) {
      return;
    }
    try {
      const nativeModule = (TurboModuleRegistry.get(
        PLUGIN_NATIVE_MODULE_NAME,
      ) ?? NativeModules[PLUGIN_NATIVE_MODULE_NAME]) as
        | IPluginStopModule
        | null
        | undefined;
      if (typeof nativeModule?.stopRecording === 'function') {
        await nativeModule.stopRecording();
      }
    } catch {
      // Not linked or not set up in this process: nothing is recording.
    }
  })();
  return stopPromise;
}
