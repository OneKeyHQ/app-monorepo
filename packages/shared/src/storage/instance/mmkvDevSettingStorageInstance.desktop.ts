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
  return bridge({ method, id: 'onekey-app-dev-setting', key, value });
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
