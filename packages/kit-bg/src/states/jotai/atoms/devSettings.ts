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
  enableMockHighTxFee?: boolean;
  disableAllShortcuts?: boolean;
  disableWebEmbedApi?: boolean; // Do not render webembedApi Webview
  webviewDebuggingEnabled?: boolean;
  allowAddSameHDWallet?: boolean;
  // enable keyless wallet feature
  isKeylessWalletFeatureEnabled?: boolean;
  // allow create keyless wallet on web platform (mock cloud backup info)
  allowCreateKeylessWalletOnWeb?: boolean;
  // allow delete keyless key (device key and auth key)
  allowDeleteKeylessKey?: boolean;

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
  showPerpsRenderStats?: boolean;

  usbCommunicationMode?: 'webusb' | 'bridge';

  // IP Table control for different environments
  // Production: disable IP Table (default false - IP Table enabled)
  disableIpTableInProd?: boolean;
  // Force IP Table strict mode: always use IP even if runtime.selections is empty
  // Fallback to first available IP from config when no selection exists
  forceIpTableStrict?: boolean;
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
      enableMockHighTxFee: false,
      disableAllShortcuts: false,
      webviewDebuggingEnabled: false,
      strictSignatureAlert: false,
      enableAnalyticsRequest: false,
      showPrimeTest: true,
      usePrimeSandboxPayment: platformEnv.isDev,
      showPerformanceMonitor: true,
      autoNavigation: {
        enabled: false,
        selectedTab: ETabRoutes.Home,
      },
      useLocalTradingViewUrl: false,
      // Linux Desktop use Bridge，avoiding WebUSB permission problem
      usbCommunicationMode: platformEnv.isDesktopLinux ? 'bridge' : 'webusb',
      disableIpTableInProd: false, // IP Table enabled by default
      forceIpTableStrict: false, // Strict mode: disabled by default
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
  forceUpdateOnceFirmware: boolean;
  forceUpdateBle: boolean;
  forceUpdateOnceBle: boolean;
  forceUpdateBootloader: boolean;
  forceUpdateOnceBootloader: boolean;
  updateDevDeviceBootloaderOnAppAllowed: boolean;
  showDeviceDebugLogs: boolean;
  showAutoCheckHardwareUpdatesToast: boolean;
  forceUpdateBtcOnlyUniversalFirmware: boolean;
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
    forceUpdateOnceFirmware: false,
    forceUpdateBle: false,
    forceUpdateOnceBle: false,
    forceUpdateBootloader: false,
    forceUpdateOnceBootloader: false,
    updateDevDeviceBootloaderOnAppAllowed: false,
    showDeviceDebugLogs: false,
    showAutoCheckHardwareUpdatesToast: false,
    forceUpdateBtcOnlyUniversalFirmware: false,
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
