/* eslint-disable @typescript-eslint/no-require-imports */
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { createBreezSdkNativeAdapter } from './breezSdkNativeAdapter';
import { resolveSparkStorageDir } from './sparkStorage.native';

import type { IBreezSdkSparkNative } from './breezSdkNativeAdapter';
import type { IBreezSdkSparkModule } from './types';

let loadPromise: Promise<IBreezSdkSparkModule> | undefined;

/**
 * Loads the Breez SDK Spark TurboModule and adapts it to the web shapes the
 * service uses. The package is required here and never imported at the top
 * of a module: importing it installs the Rust crate into the runtime that
 * imports it, and the SDK serves one JS runtime per process.
 */
export function loadBreezSdk(): Promise<IBreezSdkSparkModule> {
  loadPromise ??= (async () => {
    if (
      platformEnv.enableNativeBackgroundThread &&
      !platformEnv.isNativeBackgroundThread
    ) {
      throw new OneKeyLocalError(
        'Breez SDK Spark must load in the background runtime',
      );
    }
    let rn: IBreezSdkSparkNative;
    try {
      rn =
        require('@breeztech/breez-sdk-spark-react-native') as IBreezSdkSparkNative;
    } catch {
      // A JS bundle newer than the installed app can reach this code in an
      // app built without the native module.
      throw new OneKeyLocalError(
        'This app version does not support Lightning Self-Custody',
      );
    }
    return createBreezSdkNativeAdapter({
      rn,
      resolveStorageDir: resolveSparkStorageDir,
    });
  })().catch((error: unknown) => {
    loadPromise = undefined;
    throw error;
  });
  return loadPromise;
}
