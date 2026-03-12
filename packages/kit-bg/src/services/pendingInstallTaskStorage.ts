import type { IPendingInstallTask } from '@onekeyhq/shared/src/appUpdate';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';

/**
 * Persist pending install task across process death / app restart.
 *
 * Why persistent storage:
 * - Seamless update may download/verify in one session, then complete switch/install
 *   on next launch.
 * - The startup flow reads this task and resumes or verifies post-restart state.
 */
export async function getPendingInstallTask() {
  return appStorage.syncStorage.getObject<IPendingInstallTask>(
    EAppSyncStorageKeys.onekey_pending_install_task,
  );
}

// Write restart-recoverable install intent for the next launch.
export async function setPendingInstallTask(task: IPendingInstallTask) {
  await Promise.resolve(
    appStorage.syncStorage.setObject(
      EAppSyncStorageKeys.onekey_pending_install_task,
      task as Record<string, any>,
    ),
  );
}

// Clear task after successful apply/verify or terminal failure.
export async function clearPendingInstallTask() {
  await Promise.resolve(
    appStorage.syncStorage.delete(
      EAppSyncStorageKeys.onekey_pending_install_task,
    ),
  );
}
