// cspell:ignore breeztech
import { loadingBreezWasm } from './sparkNetwork';

import type { IBreezSdkSparkModule } from './types';

let loadPromise: Promise<IBreezSdkSparkModule> | undefined;

/**
 * Loads the Breez SDK Spark web build and initializes its wasm once per JS
 * runtime: the page of Web and the Desktop renderer, where kit-bg runs, and the
 * extension's offscreen document, where the extension runs the SDK.
 */
export function loadBreezSdk(): Promise<IBreezSdkSparkModule> {
  loadPromise ??= (async () => {
    const mod = await import('@breeztech/breez-sdk-spark');
    await loadingBreezWasm(() => mod.default());
    return mod;
  })().catch((error: unknown) => {
    loadPromise = undefined;
    throw error;
  });
  return loadPromise;
}
