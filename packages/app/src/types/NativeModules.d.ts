import type {
  CardInfo,
  Callback as LiteCallback,
} from '../hardware/OnekeyLite/types';
import type { NativeModule } from 'react-native';

export interface PermissionManagerInterface extends NativeModule {
  isOpenLocation: () => boolean;
  openLocationSetting: () => void;
}

export interface OKLiteManagerInterface extends NativeModule {
  checkNFCPermission: (call: LiteCallback<boolean>) => void;
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

export interface HTTPServerManagerInterface extends NativeModule {
  start: (
    port: number,
    name: string,
    call: (data: string, success: boolean) => void,
  ) => void;
  stop: () => void;
  respond: (id: string, code: number, type: string, body: string) => void;
}

export interface JPushManagerInterface extends NativeModule {
  registerNotification: () => void;
}

export interface MinimizerInterface extends NativeModule {
  exit: () => void;
  goBack: () => void;
  minimize: () => void;
}

export interface CacheManagerInterface extends NativeModule {
  clearWebViewData: () => Promise<boolean>;
}

export interface AppRestartInterface extends NativeModule {
  restart: () => void;
}

export interface LoggerNativeModulesInterface extends NativeModule {
  log: (msg: string) => void;
}

declare module 'react-native' {
  interface NativeModulesStatic {
    HTTPServerManager: HTTPServerManagerInterface;
    OKLiteManager: OKLiteManagerInterface;
    OKPermissionManager: PermissionManagerInterface;
    SplashScreenManager: SplashScreenManagerInterface;
    JPushManager: JPushManagerInterface;
    Minimizer: MinimizerInterface;
    CacheManager: CacheManagerInterface;
    NativeAppRestart: AppRestartInterface;
    LoggerNative: LoggerNativeModulesInterface;
  }
}
