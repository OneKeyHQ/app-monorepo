import { OneKeyLocalError } from '../errors';
import platformEnv from '../platformEnv';

import type {
  INativeStorageGlobal,
  INativeStorageRequest,
} from './nativeStorageTypes';

function getNativeStorageGlobal() {
  return globalThis as INativeStorageGlobal;
}

export async function callNativeStorage<T>(
  request: INativeStorageRequest,
): Promise<T> {
  if (platformEnv.isNativeBackgroundThread) {
    const { executeNativeStorageRequest } =
      await import('./nativeStorageExecutor');
    return executeNativeStorageRequest(request) as Promise<T>;
  }

  if (!platformEnv.isNativeMainThread) {
    throw new OneKeyLocalError(
      'Native storage bridge was called outside a native runtime',
    );
  }

  const call = getNativeStorageGlobal().__onekeyNativeStorageCall;
  if (!call) {
    throw new OneKeyLocalError(
      'Native background storage transport is not installed',
    );
  }
  return call(request) as Promise<T>;
}
