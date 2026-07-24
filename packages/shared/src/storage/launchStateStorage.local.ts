import {
  type IAppInstallationReconcileResult,
  type IAppLaunchStateStorageBackend,
  createAppLaunchStateStorage,
} from './launchStateStorage.shared';

const memoryStorage = new Map<string, string>();

function getLocalStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

const backend: IAppLaunchStateStorageBackend = {
  getItem(key) {
    const storage = getLocalStorage();
    return storage
      ? (storage.getItem(key) ?? undefined)
      : memoryStorage.get(key);
  },
  setItem(key, value) {
    const storage = getLocalStorage();
    if (storage) {
      storage.setItem(key, value);
      memoryStorage.delete(key);
      return;
    }
    memoryStorage.set(key, value);
  },
};

export const appLaunchStateStorage = createAppLaunchStateStorage(backend);

export async function reconcileAppInstallation(): Promise<IAppInstallationReconcileResult> {
  if (appLaunchStateStorage.read()) {
    return {
      classification: 'existingState',
    } satisfies IAppInstallationReconcileResult;
  }
  return {
    classification: 'unknown',
  } satisfies IAppInstallationReconcileResult;
}
