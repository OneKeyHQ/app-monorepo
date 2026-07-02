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

export type ITradingViewKLineMockEmptyInterval =
  | '1m'
  | '5m'
  | '15m'
  | '30m'
  | '1H'
  | '4H'
  | '1D'
  | '1W';

// Test account for dev login testing
export interface ITestAccount {
  id: string;
  email: string;
  otp: string;
  name?: string;
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
  // allow delete keyless key (device key and auth key)
  allowDeleteKeylessKey?: boolean;
  // show Keyless-related debug dialogs/logs in UI (dev only)
  enableKeylessDebugInfo?: boolean;
  // enable BotWallet management entry for Keyless wallet
  enableBotWalletFeature?: boolean;

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
  mockTradingViewKLineEmptyEnabled?: boolean;
  mockTradingViewKLineEmptyIntervals?: ITradingViewKLineMockEmptyInterval[];
  // Show Market Home websocket subscription debug overlay and row highlight.
  showMarketHomeWsDebug?: boolean;

  usbCommunicationMode?: 'webusb' | 'bridge';

  // IP Table control for different environments
  // Production: disable IP Table (default false - IP Table enabled)
  disableIpTableInProd?: boolean;
  // Force IP Table strict mode: always use IP even if runtime.selections is empty
  // Fallback to first available IP from config when no selection exists
  forceIpTableStrict?: boolean;
  // Enable mock market banner data for UI testing
  enableMockMarketBanner?: boolean;
  // Test accounts for OneKey ID login testing
  testAccounts?: ITestAccount[];
  // Ignore server bundle update info (prevents rollback when dev-switching bundles)
  ignoreServerBundleUpdate?: boolean;
  // Allow watching accounts to pass through bulk-send pre-flight validation.
  // Submission remains blocked; this only lets QA walk through the UI flow
  // (e.g. BTC 200+ split cases that need high balances) without a signer.
  allowBulkSendWatchingAccount?: boolean;
  // Disable custom User-Agent injection (debug only).
  // When true, buildCustomUA() returns null, all call sites fall back to
  // the runtime default UA.
  disableCustomUA?: boolean;
  // Allow Discovery browser to load local development URLs.
  allowLocalhostUrlInDAppBrowser?: boolean;
  // Force react-native-fast-pbkdf2 instead of the default quick-crypto backend
  // for native PBKDF2 calls (debug only).
  useFastPbkdf2NativeBackend?: boolean;
  // Enable Slow 4G throttling on platforms with a supported backend.
  networkThrottleEnabled?: boolean;
}

export type IDevSettingsKeys = keyof IDevSettings;

export type IDevSettingsPersistAtom = {
  enabled: boolean;
  settings?: IDevSettings;
};

export function getDevSettingsNetworkThrottleEnabled(
  devSettings: IDevSettingsPersistAtom,
  defaultEnabled: boolean,
) {
  if (!devSettings.enabled) {
    return false;
  }
  return devSettings.settings?.networkThrottleEnabled ?? defaultEnabled;
}
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
      enableKeylessDebugInfo: false,
      enableBotWalletFeature: false,
      showPrimeTest: true,
      usePrimeSandboxPayment: platformEnv.isDev,
      showPerformanceMonitor: true,
      autoNavigation: {
        enabled: false,
        selectedTab: ETabRoutes.Home,
      },
      useLocalTradingViewUrl: false,
      mockTradingViewKLineEmptyEnabled: false,
      mockTradingViewKLineEmptyIntervals: ['1m'],
      showMarketHomeWsDebug: false,
      networkThrottleEnabled: !!platformEnv.isDesktop || !!platformEnv.isNative,
      allowLocalhostUrlInDAppBrowser: false,
      // Linux Desktop uses WebUSB; host udev rules are requested when needed.
      usbCommunicationMode: 'webusb',
      disableIpTableInProd: false, // IP Table enabled by default
      forceIpTableStrict: false, // Strict mode: disabled by default
      useFastPbkdf2NativeBackend: false,
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
