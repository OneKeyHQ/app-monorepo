import type { ILocaleSymbol } from '../src/locale';
import type { ITrayAction, ITrayData } from '../src/types/desktop/tray';

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

export type IDesktopEventUnSubscribe = () => void;

// Type for the legacy desktopApi exposed via contextBridge in preload.ts
export type INobleBleApi = {
  enumerate: () => Promise<{ id: string; name: string }[]>;
  getDevice: (uuid: string) => Promise<{ id: string; name: string } | null>;
  connect: (uuid: string) => Promise<void>;
  disconnect: (uuid: string) => Promise<void>;
  subscribe: (uuid: string) => Promise<void>;
  unsubscribe: (uuid: string) => Promise<void>;
  write: (uuid: string, data: string) => Promise<void>;
  cancelPairing: () => Promise<void>;
  onNotification: (
    callback: (deviceId: string, data: string) => void,
  ) => () => void;
  onDeviceDisconnected: (
    callback: (device: { id: string; name: string }) => void,
  ) => () => void;
  checkAvailability: () => Promise<{
    available: boolean;
    state: string;
    unsupported: boolean;
    initialized: boolean;
  }>;
};

export type IDesktopApiLegacy = {
  on: (
    channel: string,
    func: (...args: any[]) => any,
  ) => IDesktopEventUnSubscribe | undefined;
  arch: string;
  platform: string;
  systemVersion: string;
  logDirectory: string;
  deskChannel: string;
  isMas: boolean;
  isDev: boolean;
  channel?: string;
  ready: () => void;
  onAppState: (cb: (state: IDesktopAppState) => void) => () => void;
  isFocused: () => boolean;
  addIpcEventListener: (
    event: string,
    listener: (...args: any[]) => void,
  ) => () => void;
  /** @deprecated Use the unsubscribe function returned by addIpcEventListener instead. */
  removeIpcEventListener: (
    event: string,
    listener: (...args: any[]) => void,
  ) => void;
  touchUpdateResource: (params: {
    resourceUrl: string;
    dialogTitle: string;
    buttonLabel: string;
  }) => void;
  openPrivacyPanel: () => void;
  startServer: (
    port: number,
    cb: (data: string, success: boolean) => void,
  ) => void;
  serverListener: (
    cb: (request: {
      requestId: string;
      postData: any;
      type: string;
      url: string;
    }) => void,
  ) => void;
  serverRespond: (
    requestId: string,
    code: number,
    type: string,
    body: string,
  ) => void;
  stopServer: () => void;
  setSystemIdleTime: (idleTime: number, cb?: () => void) => void;
  testCrash: () => void;
  nobleBle: INobleBleApi;
  getCpuUsage: () => Promise<{ usage: number }>;
  getMemoryUsage: () => Promise<{
    private: number;
    residentSet: number | undefined;
    blink: { allocated: string; total: string };
  }>;
  appVersion: string;
  markBootSuccess: () => void;
  setConsecutiveBootFailCount: (count: number) => void;
  recoveryExportLogs: () => Promise<{ error?: string }>;
  recoveryTryAgain: () => Promise<void>;
  recoveryAutoRepair: () => Promise<{ error?: string }>;
  // macOS menu bar tray — methods exist on all platforms but are no-ops
  // outside macOS (main process only wires ipcMain handlers when isMac).
  sendTrayData: (data: ITrayData) => void;
  // Only exposed inside the tray BrowserWindow (preload checks
  // `?render=tray`); `undefined` on the main renderer, so callers must
  // guard with optional chaining.
  sendTrayAction?: (action: ITrayAction) => void;
  toggleTray: (enabled: boolean) => void;
};

export type IDesktopApiBridge = {
  call: (module: string, method: string, ...params: any[]) => Promise<any>;
};

export type IDesktopGlobals = {
  sdkConnectSrc?: string;
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
  UpdateBundleData = 'updateBundleData',
  FallbackUpdateBundleData = 'fallbackUpdateBundleData',
  NativeVersion = 'nativeVersion',
  NativeBuildNumber = 'nativeBuildNumber',
  AppInstanceMetaBackup = INSTANCE_META_BACKUP_KEY,
  // GPU Crash Statistics - for monitoring
  GPUCrashCount = 'gpuCrashCount',
  LastGPUCrashTime = 'lastGPUCrashTime',
  // Boot Recovery
  ConsecutiveBootFailCount = 'consecutiveBootFailCount',
  BootFailAppVersion = 'bootFailAppVersion',
}

export type IDesktopStoreUpdateSettings = {
  useTestFeedUrl: boolean;
};

export type IDesktopStoreUpdateBundleData = {
  appVersion: string;
  bundleVersion: string;
  signature: string;
};

export type IDesktopStoreFallbackUpdateBundleData =
  IDesktopStoreUpdateBundleData[];

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
  [EDesktopStoreKeys.NativeBuildNumber]: string;
  [EDesktopStoreKeys.AppInstanceMetaBackup]: IInstanceMetaBackup;
  [EDesktopStoreKeys.UpdateBundleData]: IDesktopStoreUpdateBundleData;
  [EDesktopStoreKeys.FallbackUpdateBundleData]: IDesktopStoreFallbackUpdateBundleData;
  // GPU Crash Statistics
  [EDesktopStoreKeys.GPUCrashCount]: number;
  [EDesktopStoreKeys.LastGPUCrashTime]: number;
  // Boot Recovery
  [EDesktopStoreKeys.ConsecutiveBootFailCount]: number;
  [EDesktopStoreKeys.BootFailAppVersion]: string;
};
