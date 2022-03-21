import { NativeModule } from 'react-native';

import { FilesType } from '../cloudBackup/type';
import {
  CardInfo,
  Callback as LiteCallback,
} from '../hardware/OnekeyLite/types';

export interface OKLiteManagerInterface extends NativeModule {
  getCardName: (call: LiteCallback<string>) => void;
  getLiteInfo: (call: LiteCallback<CardInfo>) => void;
  setMnemonic: (
    mnemonic: string,
    pwd: string,
    overwrite: boolean,
    call: LiteCallback<boolean>,
  ) => void;
  getMnemonicWithPin: (pwd: string, call: LiteCallback<string>) => void;
  changePin: (
    oldPwd: string,
    newPwd: string,
    call: LiteCallback<boolean>,
  ) => void;
  reset: (call: LiteCallback<boolean>) => void;
  cancel: () => void;
  intoSetting: () => void;
}

export interface RNCloudFsInterface extends NativeModule {
  getGoogleDriveDocument: (id: string) => Promise<string>;
  getIcloudDocument: (filename: string) => Promise<string>;
  fileExists: (
    options:
      | { scope: string; targetPath: string }
      | { fileId: any; scope: string },
  ) => Promise<boolean>;
  loginIfNeeded: () => Promise<boolean>;
  syncCloud: () => Promise<boolean>;
  deleteFromCloud: (item: any) => Promise;
  listFiles: (options: {
    scope: string;
    targetPath: string;
  }) => Promise<{ files: FilesType[]; path: string }>;
  copyToCloud: (options: {
    mimeType: string;
    scope: string;
    sourcePath: { path: string };
    targetPath: string;
  }) => Promise;
  isAvailable: () => Promise<boolean>;
  logout: () => void;
}

declare module 'react-native' {
  interface NativeModulesStatic {
    OKLiteManager: OKLiteManagerInterface;
    RNCloudFs: RNCloudFsInterface;
  }
}
