import type { ILocaleSymbol } from '../src/locale';
import type { BrowserWindow } from 'electron';

export type IPrefType =
  | 'default'
  | 'camera'
  | 'bluetooth'
  | 'location'
  | 'notification'
  | 'locationService'
  | 'localNetwork';

export type IMediaType = 'camera' | 'microphone' | 'screen';

export type IDesktopAppState = 'active' | 'background' | 'blur';

export type IDesktopSubModuleInitParams = {
  APP_NAME: string;
  getSafelyMainWindow: () => BrowserWindow | undefined;
};

export type IDesktopMainProcessDevOnlyApiParams = {
  module: string;
  method: string;
  params: any[];
};

export const INSTANCE_META_BACKUP_KEY = '$onekey_backup--instance_meta';

export type IInstanceMetaBackup = {
  instanceId: string;
  sensitiveEncodeKey: string;
  instanceIdBackup:
    | {
        v4MigratedInstanceId: string | undefined;
        v5InitializedInstanceId: string | undefined;
      }
    | undefined;
};

export enum EDesktopStoreKeys {
  WinBounds = 'winBounds',
  UpdateSettings = 'updateSettings',
  DevTools = 'devTools',
  Theme = 'theme',
  EncryptedData = 'EncryptedData',
  Language = 'language',
  DisableKeyboardShortcuts = 'disableKeyboardShortcuts',
  ASCFile = 'ascFile',
  UpdateBuildNumber = 'updateBuildNumber',
  AppInstanceMetaBackup = INSTANCE_META_BACKUP_KEY,
}

export type IDesktopStoreUpdateSettings = {
  useTestFeedUrl: boolean;
};

export type IDesktopStoreMap = {
  [EDesktopStoreKeys.WinBounds]: Electron.Rectangle;
  [EDesktopStoreKeys.UpdateSettings]: IDesktopStoreUpdateSettings;
  [EDesktopStoreKeys.DevTools]: boolean;
  [EDesktopStoreKeys.Theme]: string;
  [EDesktopStoreKeys.EncryptedData]: Record<string, string>;
  [EDesktopStoreKeys.Language]: ILocaleSymbol;
  [EDesktopStoreKeys.DisableKeyboardShortcuts]: {
    disableAllShortcuts: boolean;
  };
  [EDesktopStoreKeys.ASCFile]: string;
  [EDesktopStoreKeys.UpdateBuildNumber]: string;
  [EDesktopStoreKeys.AppInstanceMetaBackup]: IInstanceMetaBackup;
};
