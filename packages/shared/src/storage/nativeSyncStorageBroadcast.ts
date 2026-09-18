import { OneKeyLocalError } from '../errors';
import platformEnv from '../platformEnv';

import type {
  INativeStorageGlobal,
  INativeSyncStorageMutation,
} from './nativeStorageTypes';

export function broadcastNativeSyncStorageMutation(
  mutation: INativeSyncStorageMutation,
) {
  if (!platformEnv.isNativeBackgroundThread) {
    throw new OneKeyLocalError(
      'Native sync storage mutations can only be broadcast by the background runtime',
    );
  }
  return (
    (globalThis as INativeStorageGlobal).__onekeyNativeSyncStorageBroadcast?.(
      mutation,
    ) ?? false
  );
}
