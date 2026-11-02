import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { IBreezSdkSparkModule } from './types';

// The React Native TurboModule build is not wired up yet. Metro cannot
// resolve the wasm package, so native must never import it.
export function loadBreezSdk(): Promise<IBreezSdkSparkModule> {
  return Promise.reject(
    new OneKeyLocalError('Breez SDK Spark is not supported on native yet'),
  );
}
