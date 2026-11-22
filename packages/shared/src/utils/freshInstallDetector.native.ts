/* cspell:ignore IMMKV */
import platformEnv from '../platformEnv';
import { travelModeManager } from '../travelMode';

import type { IMMKVInstance } from '../storage/instance/createMMKVSyncStorage';

/**
 * A fresh install has written nothing to the bg-owned settings MMKV yet.
 *
 * The jotai MMKV cannot be used: bg seeds every persisted atom into it during
 * its own boot, before main reaches the first frame. The settings store only
 * receives keys once the app has run for real (server time sync, the wallet
 * presence hint, dev settings), so it is still empty on a first launch.
 *
 * Errs towards `false`: if bg has already written a settings key, startup
 * keeps the old path; an existing install, which holds settings keys, is never
 * treated as fresh.
 */
export function isFreshInstallSync(): boolean {
  if (!platformEnv.isNativeMainThread) {
    return false;
  }
  if (travelModeManager.isMaskingDataSync()) {
    return false;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const settings = require('../storage/instance/mmkvStorageInstance')
      .default as IMMKVInstance;
    return settings.getAllKeys().length === 0;
  } catch {
    return false;
  }
}
