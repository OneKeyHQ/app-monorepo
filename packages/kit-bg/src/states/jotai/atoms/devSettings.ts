import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import type { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export interface IApiEndpointConfig {
  id: string;
  name: string;
  api: string;
  serviceModule: EServiceEndpointEnum;
  enabled: boolean;
}

export interface IDevSettings {
  // enable test endpoint
  enableTestEndpoint?: boolean;
  // enable dev overlay window
  showDevOverlayWindow?:
    | boolean
    | {
        top: number;
        align: 'left' | 'right';
      };
  // always signOnly send tx
  alwaysSignOnlySendTx?: boolean;
  // show dev export private key
  showDevExportPrivateKey?: boolean;
  // disable Solana priority fee
  disableSolanaPriorityFee?: boolean;
  disableAllShortcuts?: boolean;
  disableWebEmbedApi?: boolean; // Do not render webembedApi Webview
  webviewDebuggingEnabled?: boolean;
  allowAddSameHDWallet?: boolean;

  showPrimeTest?: boolean;
  usePrimeSandboxPayment?: boolean;
  showWebviewDevTools?: boolean;
  // strict signature alert display
  strictSignatureAlert?: boolean;
  // enable analytics requests in dev environment
  enableAnalyticsRequest?: boolean;
  autoNavigation?: {
    enabled: boolean;
    selectedTab: ETabRoutes | null;
  };
  // custom API endpoints
  customApiEndpoints?: IApiEndpointConfig[];
  // show performance monitor
  showPerformanceMonitor?: boolean;
  // use local trading view URL for development
  useLocalTradingViewUrl?: boolean;
  // enable market V2 (new version), default false uses V1
  enableMarketV2?: boolean;
}

export type IDevSettingsKeys = keyof IDevSettings;

export type IDevSettingsPersistAtom = {
  enabled: boolean;
  settings?: IDevSettings;
};
export const {
  target: devSettingsPersistAtom,
  use: useDevSettingsPersistAtom,
} = globalAtom<IDevSettingsPersistAtom>({
  persist: true,
  name: EAtomNames.devSettingsPersistAtom,
  initialValue: {
    enabled: !!platformEnv.isDev || !!platformEnv.isE2E,
    settings: {
      enableTestEndpoint: !!platformEnv.isDev || !!platformEnv.isE2E,
      showDevOverlayWindow: platformEnv.isE2E ? true : undefined,
      disableSolanaPriorityFee: false,
      disableAllShortcuts: false,
      webviewDebuggingEnabled: false,
      strictSignatureAlert: false,
      enableAnalyticsRequest: false,
      showPrimeTest: true,
      usePrimeSandboxPayment: platformEnv.isDev,
      showPerformanceMonitor: true,
      autoNavigation: {
        enabled: false,
        selectedTab: ETabRoutes.Discovery,
      },
      useLocalTradingViewUrl: false,
      enableMarketV2: false,
    },
  },
});

export type IFirmwareUpdateDevSettings = {
  lowBatteryLevel: boolean;
  shouldUpdateBridge: boolean;
  shouldUpdateFullRes: boolean;
  shouldUpdateFromWeb: boolean;
  allIsUpToDate: boolean;
  usePreReleaseConfig: boolean;
  forceUpdateResEvenSameVersion: boolean;
  forceUpdateFirmware: boolean;
  forceUpdateBle: boolean;
  forceUpdateBootloader: boolean;
  showDeviceDebugLogs: boolean;
  showAutoCheckHardwareUpdatesToast: boolean;
};
export type IFirmwareUpdateDevSettingsKeys = keyof IFirmwareUpdateDevSettings;
export const {
  target: firmwareUpdateDevSettingsPersistAtom,
  use: useFirmwareUpdateDevSettingsPersistAtom,
} = globalAtom<IFirmwareUpdateDevSettings>({
  persist: true,
  name: EAtomNames.firmwareUpdateDevSettingsPersistAtom,
  initialValue: {
    lowBatteryLevel: false,
    shouldUpdateBridge: false,
    shouldUpdateFullRes: false,
    shouldUpdateFromWeb: false,
    allIsUpToDate: false,
    usePreReleaseConfig: false,
    forceUpdateResEvenSameVersion: false,
    forceUpdateFirmware: false,
    forceUpdateBle: false,
    forceUpdateBootloader: false,
    showDeviceDebugLogs: false,
    showAutoCheckHardwareUpdatesToast: false,
  },
});

export type INotificationsDevSettings = {
  showMessagePushSource?: boolean;
  disabledWebSocket?: boolean;
  disabledJPush?: boolean;
};
export type INotificationsDevSettingsKeys = keyof INotificationsDevSettings;
export const {
  target: notificationsDevSettingsPersistAtom,
  use: useNotificationsDevSettingsPersistAtom,
} = globalAtom<INotificationsDevSettings>({
  persist: true,
  name: EAtomNames.notificationsDevSettingsPersistAtom,
  initialValue: {
    showMessagePushSource: false,
    disabledWebSocket: false,
    disabledJPush: false,
  },
});
