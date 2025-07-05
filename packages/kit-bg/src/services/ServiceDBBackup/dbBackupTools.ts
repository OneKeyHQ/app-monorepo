import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IInstanceMetaBackup } from '@onekeyhq/shared/types/desktop';
import {
  EDesktopStoreKeys,
  INSTANCE_META_BACKUP_KEY,
} from '@onekeyhq/shared/types/desktop';

async function backupInstanceMeta(instanceMeta: IInstanceMetaBackup) {
  try {
    if (platformEnv.isExtension) {
      await globalThis.chrome.storage.local.set({
        [INSTANCE_META_BACKUP_KEY]: instanceMeta,
      });
    }
  } catch (error) {
    console.error('isExtension backupInstanceMeta error', error);
  }
  try {
    if (platformEnv.isDesktop) {
      await globalThis.desktopApiProxy?.storage?.storeSetItemAsync(
        EDesktopStoreKeys.AppInstanceMetaBackup, // INSTANCE_META_BACKUP_KEY,
        instanceMeta,
      );
    }
  } catch (error) {
    console.error('isDesktop backupInstanceMeta error', error);
  }
  try {
    if (platformEnv.isRuntimeBrowser) {
      globalThis.localStorage.setItem(
        INSTANCE_META_BACKUP_KEY,
        JSON.stringify(instanceMeta),
      );
    }
  } catch (error) {
    console.error('isRuntimeBrowser backupInstanceMeta error', error);
  }
}

async function getBackupedInstanceMeta(): Promise<
  IInstanceMetaBackup | undefined
> {
  let result: IInstanceMetaBackup | undefined;

  try {
    if (platformEnv.isExtension) {
      const data = await globalThis.chrome.storage.local.get(
        INSTANCE_META_BACKUP_KEY,
      );
      if (data?.[INSTANCE_META_BACKUP_KEY]) {
        result = data[INSTANCE_META_BACKUP_KEY] as IInstanceMetaBackup;
      }
    }
  } catch (error) {
    console.error('isExtension getBackupedInstanceMeta error', error);
  }

  try {
    if (platformEnv.isDesktop) {
      result = await globalThis.desktopApiProxy?.storage?.storeGetItemAsync(
        EDesktopStoreKeys.AppInstanceMetaBackup,
      );
    }
  } catch (error) {
    console.error('isDesktop getBackupedInstanceMeta error', error);
  }

  try {
    if (platformEnv.isRuntimeBrowser && !result) {
      const resultStr = globalThis.localStorage.getItem(
        INSTANCE_META_BACKUP_KEY,
      );
      if (resultStr) {
        result = JSON.parse(resultStr);
      }
    }
  } catch (error) {
    console.error('isRuntimeBrowser getBackupedInstanceMeta error', error);
  }

  return result;
}

export default { backupInstanceMeta, getBackupedInstanceMeta };
