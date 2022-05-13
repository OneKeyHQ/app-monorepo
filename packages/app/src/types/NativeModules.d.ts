import { NativeModule } from 'react-native';

import {
  CardInfo,
  Callback as LiteCallback,
} from '../hardware/OnekeyLite/types';

export interface PermissionManagerInterface extends NativeModule {
  isOpenLocation: () => boolean;
  openLocationSetting: () => void;
}

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

export interface SplashScreenManagerInterface extends NativeModule {
  show: () => void;
}

/**
 * 获取安装包渠道（Android only）
 */
export interface BuildConfigManagerInterface extends NativeModule {
  getChannel: () => string;
}

declare module 'react-native' {
  interface NativeModulesStatic {
    OKLiteManager: OKLiteManagerInterface;
    OKPermissionManager: PermissionManagerInterface;
    SplashScreenManager: SplashScreenManagerInterface;
    BuildConfigManager: BuildConfigManagerInterface;
  }
}
