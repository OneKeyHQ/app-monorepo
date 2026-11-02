import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { IBreezSdkSparkModule } from './types';

// The MV3 service worker needs a storage shim before connect, so the
// extension keeps the wasm out of its bundles until that loader exists.
export function loadBreezSdk(): Promise<IBreezSdkSparkModule> {
  return Promise.reject(
    new OneKeyLocalError(
      'Breez SDK Spark is not supported in the extension yet',
    ),
  );
}
