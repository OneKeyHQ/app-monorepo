import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

type IMmkvSyncBridge = (args: {
  method: string;
  id: string;
  key?: string;
  value?: unknown;
}) => unknown;

function ipc(method: string, key?: string, value?: boolean | string | number) {
  const bridge = (globalThis as { $mmkvSync?: IMmkvSyncBridge }).$mmkvSync;
  // The tray renderer has no storage bridge and must behave as an empty store.
  if (typeof bridge !== 'function') {
    return undefined;
  }
  // Update verification in the main process reads this same persistent store.
  const result = bridge({
    method,
    id: 'onekey-app-dev-setting',
    key,
    value,
  });
  if (
    result &&
    typeof result === 'object' &&
    (result as { __onekeyMmkvSyncError?: unknown }).__onekeyMmkvSyncError ===
      true
  ) {
    const message =
      typeof (result as { message?: unknown }).message === 'string'
        ? (result as { message: string }).message
        : `Desktop MMKV ${method} failed`;
    throw new OneKeyLocalError(message);
  }
  return result;
}

const mmkvDevSettingStorageInstance = {
  set(key: string, value: boolean | string | number): void {
    ipc('set', key, value);
  },
  getBoolean(key: string): boolean | undefined {
    const value = ipc('getBoolean', key);
    return typeof value === 'boolean' ? value : undefined;
  },
  remove(key: string): boolean {
    return ipc('remove', key) === true;
  },
  clearAll(): void {
    ipc('clearAll');
  },
};

export default mmkvDevSettingStorageInstance;
