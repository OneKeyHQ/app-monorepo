import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { IBreezSdkSparkModule } from './types';

// Extension pages never run the SDK: kit-bg runs in the service worker
// (breezSdk.ext-bg-v3.ts), which forwards to the offscreen document. This stub
// keeps the wasm glue out of the UI bundles.
export function loadBreezSdk(): Promise<IBreezSdkSparkModule> {
  return Promise.reject(
    new OneKeyLocalError('Extension pages do not load the Breez SDK Spark'),
  );
}
