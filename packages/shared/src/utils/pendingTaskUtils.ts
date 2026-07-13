import { syncStorage } from '../storage/instance/syncStorageInstance';
import { EAppSyncStorageKeys } from '../storage/syncStorageKeys';

/**
 * Check if there is a pending OTA install task via MMKV (synchronous).
 * Designed for main thread startup — no RPC, no async, minimal imports.
 */
export function hasPendingInstallTask(): boolean {
  try {
    return Boolean(
      syncStorage.getString(EAppSyncStorageKeys.onekey_pending_install_task),
    );
  } catch {
    return false;
  }
}
