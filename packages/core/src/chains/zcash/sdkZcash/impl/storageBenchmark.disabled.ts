import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type {
  IZcashStorageBenchmarkCase,
  IZcashStorageBenchmarkPreset,
  IZcashStorageBenchmarkResult,
} from '../types/sdk';

export function runStorageBenchmark(_params: {
  testCase: IZcashStorageBenchmarkCase;
  preset: IZcashStorageBenchmarkPreset;
}): Promise<IZcashStorageBenchmarkResult> {
  return Promise.reject(
    new OneKeyLocalError(
      'Zcash storage benchmark is disabled. Use a development build or set ZCASH_STORAGE_BENCHMARK=1 for an internal production test build.',
    ),
  );
}
