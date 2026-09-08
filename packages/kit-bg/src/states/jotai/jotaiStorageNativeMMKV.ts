/**
 * Non-native stub for the MMKV-backed Jotai storage.
 *
 * Web, desktop and extension builds resolve this file instead of
 * `jotaiStorageNativeMMKV.native.ts`, keeping the native migration module
 * chain (and its `react-native` imports) out of non-native startup graphs.
 * The factory is only called behind `platformEnv.isNativeBackgroundThread`
 * and must never run here. Jest maps this module to the `.native`
 * implementation via `moduleNameMapper`.
 */
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { JotaiStorageNativeMMKV } from './jotaiStorageNativeMMKV.native';

export type { JotaiStorageNativeMMKV };

export function createJotaiStorageNativeMMKV(): JotaiStorageNativeMMKV {
  throw new OneKeyLocalError(
    'Jotai MMKV storage is only available on the native background runtime',
  );
}
