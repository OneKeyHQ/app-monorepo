import { safeStorage } from 'electron';
import logger from 'electron-log/main';
import Store from 'electron-store';

import {
  EDesktopStoreKeys,
  type IDesktopStoreMap,
  type IDesktopStoreUpdateSettings,
} from '@onekeyhq/shared/types/desktop';

const store = new Store<IDesktopStoreMap>({ name: 'OneKey' });

export type ILocalStore = {
  getUpdateSettings(): IDesktopStoreUpdateSettings;
  setUpdateSettings(updateSettings: IDesktopStoreUpdateSettings): void;
  clear(): void;
};

export const instance = store;

export const clear = () => {
  store.clear();
};

export const getUpdateSettings = () =>
  store.get(EDesktopStoreKeys.UpdateSettings, {
    useTestFeedUrl: false,
  });

export const setUpdateSettings = (
  updateSettings: IDesktopStoreUpdateSettings,
): void => {
  store.set(EDesktopStoreKeys.UpdateSettings, updateSettings);
};

export const getDevTools = () => store.get(EDesktopStoreKeys.DevTools, false);

export const setDevTools = (devTools: boolean) => {
  store.set(EDesktopStoreKeys.DevTools, devTools);
};

export const getDisableKeyboardShortcuts = () =>
  store.get(EDesktopStoreKeys.DisableKeyboardShortcuts, {
    disableAllShortcuts: false,
  });

export const setDisableKeyboardShortcuts = (config: {
  disableAllShortcuts?: boolean;
}) => {
  store.set(EDesktopStoreKeys.DisableKeyboardShortcuts, {
    ...getDisableKeyboardShortcuts(),
    ...config,
  });
};

export const getTheme = () => store.get(EDesktopStoreKeys.Theme, 'system');

export const setTheme = (theme: string) =>
  store.set(EDesktopStoreKeys.Theme, theme);

export const getLanguage = () =>
  store.get(EDesktopStoreKeys.Language, 'system');

export const setLanguage = (lang: string) =>
  store.set(EDesktopStoreKeys.Language, lang);

export const getWinBounds = (): Electron.Rectangle =>
  store.get(EDesktopStoreKeys.WinBounds, {} as any);

export const setWinBounds = (bounds: Electron.Rectangle) =>
  store.set(EDesktopStoreKeys.WinBounds, bounds);

export const clearUpdateSettings = () => {
  store.delete(EDesktopStoreKeys.UpdateSettings);
};

export const getSecureItem = (key: string) => {
  const available = safeStorage.isEncryptionAvailable();
  if (!available) {
    logger.error('safeStorage is not available');
    return undefined;
  }
  const item = store.get(EDesktopStoreKeys.EncryptedData, {});
  const value = item[key];
  if (value) {
    try {
      const result = safeStorage.decryptString(Buffer.from(value, 'hex'));
      return result;
    } catch (e) {
      logger.error(`failed to decrypt ${key}`);
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
    const items = store.get(EDesktopStoreKeys.EncryptedData, {});
    items[key] = safeStorage.encryptString(value).toString('hex');
    store.set(EDesktopStoreKeys.EncryptedData, items);
  } catch (e) {
    logger.error(`failed to encrypt ${key}`);
  }
};

export const deleteSecureItem = (key: string) => {
  const items = store.get(EDesktopStoreKeys.EncryptedData, {});
  delete items[key];
  store.set(EDesktopStoreKeys.EncryptedData, items);
};

export const setASCFile = (ascFile: string) => {
  store.set(EDesktopStoreKeys.ASCFile, ascFile);
};

export const getASCFile = () => store.get(EDesktopStoreKeys.ASCFile, '');

export const clearASCFile = () => {
  store.delete(EDesktopStoreKeys.ASCFile);
};

export const setUpdateBuildNumber = (buildNumber: string) => {
  store.set(EDesktopStoreKeys.UpdateBuildNumber, buildNumber);
};

export const getUpdateBuildNumber = () =>
  store.get(EDesktopStoreKeys.UpdateBuildNumber, '');

export const clearUpdateBuildNumber = () => {
  store.delete(EDesktopStoreKeys.UpdateBuildNumber);
};
