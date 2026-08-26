import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import type { IPro2FirmwareUpdateTarget } from '@onekeyhq/shared/types/device';
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
  // OK-59934 rollout gate: play hardware interactions on the DeviceStage
  // and mute the legacy hardware dialogs/toasts it replaces.
  deviceStageEnabled?: boolean;
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
  // show performance monitor, replacing legacy showPerformanceMonitor which
  // was default-on in older dev builds.
  showPerformanceMonitorV2?: boolean;
  // use local trading view URL for development
  useLocalTradingViewUrl?: boolean;
  // show the TradingViewNative event log panel
  showTradingViewNativeDebugPanel?: boolean;
  showPerpsRenderStats?: boolean;
  // Route Unifold deposits to the Arbitrum USDC destination instead of
  // HyperCore, so the whole deposit pipeline can be exercised for source-chain
  // gas only (funds settle back into the user's own wallet). Dev builds only —
  // production always uses the HyperCore destination.
  unifoldUseTestDestination?: boolean;
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
  // Kill switch for fast failover under extreme network conditions.
  disableIpTableFailover?: boolean;
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
  // Open external links in the system browser instead of the native in-app
  // browser (SFSafariViewController / Chrome Custom Tabs). Native only.
  useSystemBrowserForExternalLinks?: boolean;
  // Force react-native-fast-pbkdf2 instead of the default quick-crypto backend
  // for native PBKDF2 calls (debug only).
  useFastPbkdf2NativeBackend?: boolean;
  // Enable Slow 4G throttling on platforms with a supported backend.
  networkThrottleEnabled?: boolean;
  // Force kaspa refTx fetch to fail, so QA can verify the blind-sign fallback.
  mockKaspaRefTxFetchFailed?: boolean;
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
      deviceStageEnabled: false,
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
      showPerformanceMonitor: false,
      showPerformanceMonitorV2: false,
      autoNavigation: {
        enabled: false,
        selectedTab: ETabRoutes.Home,
      },
      useLocalTradingViewUrl: false,
      showTradingViewNativeDebugPanel: false,
      mockTradingViewKLineEmptyEnabled: false,
      mockTradingViewKLineEmptyIntervals: ['1m'],
      showMarketHomeWsDebug: false,
      networkThrottleEnabled: !!platformEnv.isDesktop || !!platformEnv.isNative,
      allowLocalhostUrlInDAppBrowser: false,
      // Linux Desktop uses WebUSB; host udev rules are requested when needed.
      usbCommunicationMode: 'webusb',
      disableIpTableInProd: false, // IP Table enabled by default
      forceIpTableStrict: false, // Strict mode: disabled by default
      disableIpTableFailover: false, // Fast failover enabled by default
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
  pro2ForceUpdateTargets: IPro2FirmwareUpdateTarget[];
  pro2ForceUpdateOnceTargets: IPro2FirmwareUpdateTarget[];
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
    pro2ForceUpdateTargets: [],
    pro2ForceUpdateOnceTargets: [],
  },
});

// Firmware update dev settings only take effect while global developer mode is
// enabled; callers outside ServiceDevSetting must go through this gate too.
export async function getGatedFirmwareUpdateDevSetting<
  T extends IFirmwareUpdateDevSettingsKeys,
>(key: T): Promise<IFirmwareUpdateDevSettings[T] | undefined> {
  const dev = await devSettingsPersistAtom.get();
  if (!dev.enabled) {
    return undefined;
  }
  const fwDev = await firmwareUpdateDevSettingsPersistAtom.get();
  return fwDev[key];
}

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

/**
 * OK-59934 rollout gate. It lives in dev settings rather than a runtime
 * atom of its own so a tester can flip it once and keep it across app
 * restarts, and reach it from every platform's Dev mode page instead of
 * a console.
 */
export function readDeviceStageEnabled(
  devSettings: IDevSettingsPersistAtom | undefined,
): boolean {
  if (!devSettings?.enabled) {
    return false;
  }
  return Boolean(devSettings.settings?.deviceStageEnabled);
}

export function useDeviceStageEnabledAtom(): [boolean] {
  const [devSettings] = useDevSettingsPersistAtom();
  return [readDeviceStageEnabled(devSettings)];
}
