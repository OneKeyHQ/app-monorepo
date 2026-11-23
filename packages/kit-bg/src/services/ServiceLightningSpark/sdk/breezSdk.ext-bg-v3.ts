import appGlobals from '@onekeyhq/shared/src/appGlobals';

import { createOffscreenBreezSdk } from './breezSdkOffscreenClient';

import type { IBreezSdkSparkModule } from './types';

let loadPromise: Promise<IBreezSdkSparkModule> | undefined;

/**
 * Extension service worker: the SDK runs in the offscreen document, and every
 * call goes there. The wasm stays out of the service worker's bundle.
 */
export function loadBreezSdk(): Promise<IBreezSdkSparkModule> {
  loadPromise ??= createOffscreenBreezSdk(
    appGlobals.$offscreenApiProxy.lightningSparkSdk,
  ).catch((error: unknown) => {
    loadPromise = undefined;
    throw error;
  });
  return loadPromise;
}
