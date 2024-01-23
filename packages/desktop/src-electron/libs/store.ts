import { safeStorage } from 'electron';
import Store from 'electron-store';

const store = new Store();

export type LocalStore = {
  getUpdateSettings(): UpdateSettings;
  setUpdateSettings(updateSettings: UpdateSettings): void;
  clearUpdateSettings(): void;
};

export type UpdateSettings = {
  useTestFeedUrl: boolean;
};

const EncryptedData = 'EncryptedData';

export const getUpdateSettings = (): UpdateSettings =>
  store.get('updateSettings', { useTestFeedUrl: false }) as UpdateSettings;

export const setUpdateSettings = (updateSettings: UpdateSettings): void => {
  store.set('updateSettings', updateSettings);
};

export const clearUpdateSettings = () => {
  store.delete('updateSettings');
};

export const getSecureItem = (key: string) => {
  const available = safeStorage.isEncryptionAvailable();
  if (!available) {
    console.error('safeStorage is not available');
    return undefined;
  }
  const item = store.get(EncryptedData, {}) as Record<string, string>;
  const value = item[key];
  if (value) {
    try {
      const result = safeStorage.decryptString(Buffer.from(value, 'hex'));
      return result;
    } catch (e) {
      console.error(`failed to decrypt ${key}`, e);
      return undefined;
    }
  }
};

export const setSecureItem = (key: string, value: string): void => {
  const available = safeStorage.isEncryptionAvailable();
  if (!available) {
    console.error('safeStorage is not available');
    return undefined;
  }
  try {
    const items = store.get(EncryptedData, {}) as Record<string, string>;
    items[key] = safeStorage.encryptString(value).toString('hex');
    store.set(EncryptedData, items);
  } catch (e) {
    console.error(`failed to encrypt ${key} ${value}`, e);
  }
};

export const clearSecureItem = (key: string) => {
  const items = store.get(EncryptedData, {}) as Record<string, string>;
  delete items[key];
  store.set(EncryptedData, items);
};
