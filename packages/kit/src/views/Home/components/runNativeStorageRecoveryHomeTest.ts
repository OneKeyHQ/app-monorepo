import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { getNativeStorageMigrationRecoveryTarget } from '@onekeyhq/shared/src/storage/nativeStorageTypes';

export async function runNativeStorageRecoveryHomeTest(
  isActive: () => boolean,
) {
  if (!isActive()) return;
  try {
    await backgroundApiProxy.serviceDevSetting.nativeStorageRecoveryTest({
      action: 'homeRead',
    });
  } catch (error) {
    if (!isActive()) return;
    const data =
      error && typeof error === 'object' && 'data' in error
        ? error.data
        : undefined;
    const sessionId =
      data &&
      typeof data === 'object' &&
      'nativeStorageRecoveryTestSessionId' in data
        ? data.nativeStorageRecoveryTestSessionId
        : undefined;
    if (
      typeof sessionId !== 'string' ||
      !sessionId.startsWith('storage-repair-test-') ||
      getNativeStorageMigrationRecoveryTarget(error) !== 'appStorage'
    ) {
      throw error;
    }
    appEventBus.emit(EAppEventBusNames.ShowToast, {
      method: 'error',
      title:
        error && typeof error === 'object' && 'message' in error
          ? String(error.message)
          : '',
      nativeStorageRecoveryTestSessionId: sessionId,
    });
  }
}
