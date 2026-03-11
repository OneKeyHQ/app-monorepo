import type { IPendingInstallTask } from '@onekeyhq/shared/src/appUpdate';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';

export async function getPendingInstallTask() {
  return appStorage.syncStorage.getObject<IPendingInstallTask>(
    EAppSyncStorageKeys.onekey_pending_install_task,
  );
}

export async function setPendingInstallTask(task: IPendingInstallTask) {
  await appStorage.syncStorage.setObject(
    EAppSyncStorageKeys.onekey_pending_install_task,
    task as Record<string, any>,
  );
}

export async function clearPendingInstallTask() {
  await appStorage.syncStorage.delete(
    EAppSyncStorageKeys.onekey_pending_install_task,
  );
}
