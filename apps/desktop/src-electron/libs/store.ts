import { safeStorage } from 'electron';
import logger from 'electron-log';
import Store from 'electron-store';

const store = new Store({ name: 'OneKey' });

export type ILocalStore = {
  getUpdateSettings(): IUpdateSettings;
  setUpdateSettings(updateSettings: IUpdateSettings): void;
  clear(): void;
};

export type IUpdateSettings = {
  useTestFeedUrl: boolean;
};

const configKeys = {
  WinBounds: 'winBounds',
  UpdateSettings: 'updateSettings',
  EncryptedData: 'OneKey_EncryptedData',
};

export const getUpdateSettings = (): IUpdateSettings =>
  store.get(configKeys.UpdateSettings, {
    useTestFeedUrl: false,
  }) as IUpdateSettings;

export const setUpdateSettings = (updateSettings: IUpdateSettings): void => {
  store.set(configKeys.UpdateSettings, updateSettings);
};

export const getWinBounds = (): Electron.Rectangle =>
  store.get(configKeys.WinBounds, {}) as Electron.Rectangle;
export const setWinBounds = (bounds: Electron.Rectangle) =>
  store.set(configKeys.WinBounds, bounds);

export const clear = () => {
  store.clear();
};

export const clearUpdateSettings = () => {
  store.delete('updateSettings');
};

export const getSecureItem = (key: string) => {
  const available = safeStorage.isEncryptionAvailable();
  if (!available) {
    logger.error('safeStorage is not available');
    return undefined;
  }
  const item = store.get(configKeys.EncryptedData, {}) as Record<
    string,
    string
  >;
  const value = item[key];
  if (value) {
    try {
      const result = safeStorage.decryptString(Buffer.from(value, 'hex'));
      return result;
    } catch (e) {
      logger.error(`failed to decrypt ${key}`, e);
      return undefined;
    }
  }
};

export const setSecureItem = (key: string, value: string): void => {
  const available = safeStorage.isEncryptionAvailable();
  if (!available) {
    logger.error('safeStorage is not available');
    return undefined;
  }
  try {
    const items = store.get(configKeys.EncryptedData, {}) as Record<
      string,
      string
    >;
    items[key] = safeStorage.encryptString(value).toString('hex');
    store.set(configKeys.EncryptedData, items);
  } catch (e) {
    logger.error(`failed to encrypt ${key} ${value}`, e);
  }
};

export const deleteSecureItem = (key: string) => {
  const items = store.get(configKeys.EncryptedData, {}) as Record<
    string,
    string
  >;
  delete items[key];
  store.set(configKeys.EncryptedData, items);
};
