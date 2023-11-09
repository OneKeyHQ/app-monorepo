import { createSlice } from '@reduxjs/toolkit';
import { dequal as deepEqual } from 'dequal';
import { debounce, uniq } from 'lodash';
import uuid from 'react-native-uuid';

import type { ILocaleSymbol } from '@onekeyhq/components/src/locale';
import { getTimeStamp } from '@onekeyhq/kit/src/utils/helper';
// import type { FirmwareType } from '@onekeyhq/kit/src/views/Hardware/UpdateFirmware/Updating';
import { defaultHapticStatus } from '@onekeyhq/shared/src/haptics';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EOnekeyDomain } from '@onekeyhq/shared/types';

// import { ValidationFields } from '../../components/Protected/types';

// import type {
//   BLEFirmwareInfo,
//   SYSFirmwareInfo,
//   VersionInfo,
// } from '../../utils/updates/type';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { ImageSourcePropType } from 'react-native';

export type WalletSwitchItem = {
  logo: ImageSourcePropType;
  title: string;
  propertyKeys: string[];
  enable: boolean;
};

export type FirmwareUpdate = {
  forceFirmware: boolean;
  forceBle: boolean;
  firmware?: SYSFirmwareInfo;
  ble?: BLEFirmwareInfo;
};
export type ISettingsDevModeInfo = {
  enable?: boolean;
  preReleaseUpdate?: boolean;
  updateDeviceBle?: boolean;
  updateDeviceSys?: boolean;
  updateDeviceRes?: boolean;
  enableTestFiatEndpoint?: boolean;
  enableZeroNotificationThreshold?: boolean;
  enablePerfCheck?: boolean;
  defiBuildService?: string;
  hideDiscoverContent?: boolean;
  onRamperTestMode?: boolean;
  showWebEmbedWebviewAgent?: boolean;
  showContentScriptReloadButton?: boolean;
};
export type SettingsState = {
  theme: 'light' | 'dark' | 'system';
  lastLocale: ILocaleSymbol;
  locale: ILocaleSymbol;
  version: string;
  buildNumber?: string;
  instanceId: string;
  enableAppLock: boolean;
  enableLocalAuthentication: boolean;
  selectedFiatMoneySymbol: string;
  appLockDuration: number;
  refreshTimeStamp: number;
  autoRefreshTimeStamp: number;
  swapSlippagePercent: string;
  disableSwapExactApproveAmount?: boolean;
  enableHaptics: boolean;
  enableWebAuthn?: boolean;
  disableExt?: boolean;
  disableExtSwitchTips?: boolean;
  deviceUpdates?: Record<
    string, // connectId
    FirmwareUpdate
  >;
  walletSwitchData?: Record<
    string, // networkId + walletName
    WalletSwitchItem
  >;
  devMode?: ISettingsDevModeInfo;
  pushNotification?: {
    registrationId?: string;
    threshold: number;
    pushEnable: boolean;
    btcAndEthPriceAlertEnable: boolean;
    favoriteTokensPriceAlertEnable: boolean;
    priceAlertEnable: boolean;
    accountActivityPushEnable: boolean;
  };
  // validationSetting?: {
  //   [ValidationFields.Account]?: boolean;
  //   [ValidationFields.Payment]?: boolean;
  //   [ValidationFields.Secret]?: boolean;
  //   [ValidationFields.Wallet]?: boolean;
  // };
  hideSmallBalance?: boolean;
  hideRiskTokens?: boolean;
  putMainTokenOnTop?: boolean;
  hideScamHistory?: boolean;
  includeNFTsInTotal?: boolean;
  hideBalance?: boolean;
  updateSetting?: {
    autoDownload: boolean;
    updateLatestVersion: string | null;
    updateLatestTimeStamp: number | null;
  };
  customNetworkRpcMap?: {
    [networkId: string]: string[];
  };
  accountDerivationDbMigrationVersion?: string;
  hardware?: {
    rememberPassphraseWallets?: string[];
    verification?: Record<string, boolean>; // connectId -> verified
    versions?: Record<string, string>; // connectId -> version
  };
  // softwareUpdate?: {
  //   forceUpdateVersionInfo?: VersionInfo;
  // };
  leftSidebarCollapsed?: boolean;
  enableETH2Unstake?: boolean;
  advancedSettings?: {
    useDustUtxo?: boolean;
  };
  hardwareConnectSrc?: EOnekeyDomain;
  gasPanelEIP1559Enabled?: boolean;
  showTokenDetailPriceChart?: boolean;
  hideAllNetworksSelectNetworkTips?: boolean;
};

export const defaultPushNotification = {
  threshold: 5,
  pushEnable: false,
  priceAlertEnable: false,
  btcAndEthPriceAlertEnable: false,
  favoriteTokensPriceAlertEnable: false,
  accountActivityPushEnable: false,
};

const initialState: SettingsState = {
  theme: 'system',
  lastLocale: 'system',
  locale: 'system',
  version: process.env.VERSION ?? '1.0.0',
  buildNumber: process.env.BUILD_NUMBER ?? '2022010100',
  instanceId: uuid.v4() as string,
  enableAppLock: false,
  enableLocalAuthentication: false,
  disableExt: false,
  disableExtSwitchTips: false,
  appLockDuration: 240,
  enableHaptics: defaultHapticStatus,
  selectedFiatMoneySymbol: 'usd',
  refreshTimeStamp: getTimeStamp(),
  autoRefreshTimeStamp: getTimeStamp(),
  swapSlippagePercent: '1',
  deviceUpdates: {},
  walletSwitchData: {},
  devMode: {
    enable: false,
    preReleaseUpdate: false,
    updateDeviceBle: false,
    updateDeviceSys: false,
    updateDeviceRes: false,
    enableTestFiatEndpoint: false,
    enableZeroNotificationThreshold: false,
    enablePerfCheck: false,
    defiBuildService: undefined,
    onRamperTestMode: false,
  },
  pushNotification: defaultPushNotification,
  // validationSetting: {
  //   [ValidationFields.Account]: false,
  //   [ValidationFields.Payment]: false,
  //   [ValidationFields.Secret]: false,
  //   [ValidationFields.Wallet]: false,
  // },
  hideSmallBalance: false,
  hideRiskTokens: true,
  putMainTokenOnTop: false,
  hideScamHistory: true,
  includeNFTsInTotal: true,
  hideBalance: false,
  updateSetting: {
    autoDownload: true,
    updateLatestVersion: null,
    updateLatestTimeStamp: null,
  },
  disableSwapExactApproveAmount: false,
  customNetworkRpcMap: {},
  accountDerivationDbMigrationVersion: '',
  hardware: {
    rememberPassphraseWallets: [], // walletId
    verification: {}, // connectId -> verified
    versions: {}, // connectId -> version
  },
  softwareUpdate: {
    forceUpdateVersionInfo: undefined,
  },
  advancedSettings: {
    useDustUtxo: true,
  },
  hardwareConnectSrc: EOnekeyDomain.ONEKEY_SO,
  gasPanelEIP1559Enabled: true,
  hideAllNetworksSelectNetworkTips: false,
};

export const THEME_PRELOAD_STORAGE_KEY = 'ONEKEY_THEME_PRELOAD';
export const setThemePreloadToLocalStorage = debounce(
  (value: string, forceUpdate = true) => {
    try {
      const key = THEME_PRELOAD_STORAGE_KEY;
      if (platformEnv.isRuntimeBrowser) {
        if (forceUpdate || !localStorage.getItem(key)) {
          localStorage.setItem(key, value);
        }

        if (!platformEnv.isWebEmbed) {
          // same to preload-html-head.js
          if (value === 'dark') {
            document.documentElement.style.backgroundColor = 'rgb(19, 19, 27)';
          }
          if (value === 'light' || value === 'system') {
            // document.documentElement.style.backgroundColor = 'white';
          }
        }
      }
    } catch (error) {
      console.error(error);
    }
  },
  600,
  {
    leading: false,
    trailing: true,
  },
);
setThemePreloadToLocalStorage(initialState.theme, false);

function equalFirmwareUpdate(a: any, b: any): boolean {
  try {
    // a and b are Proxy objects, so we need to use JSON to compare
    const valueA = JSON.parse(JSON.stringify(a));
    const valueB = JSON.parse(JSON.stringify(b));
    return deepEqual(valueA, valueB);
  } catch (error) {
    return false;
  }
}

export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    updateVersionAndBuildNumber: (
      state,
      action: PayloadAction<Pick<SettingsState, 'version' | 'buildNumber'>>,
    ) => {
      state.version = action.payload.version;
      state.buildNumber = action.payload.buildNumber;
    },
    setTheme: (state, action: PayloadAction<ThemeVariant | 'system'>) => {
      state.theme = action.payload;
    },
    setLocale: (state, action: PayloadAction<ILocaleSymbol>) => {
      state.lastLocale = state.locale;
      state.locale = action.payload;
    },
    setEnableAppLock: (state, action: PayloadAction<boolean>) => {
      state.enableAppLock = action.payload;
    },
    toggleEnableLocalAuthentication: (state) => {
      state.enableLocalAuthentication = !state.enableLocalAuthentication;
    },
    setEnableLocalAuthentication: (state, action: PayloadAction<boolean>) => {
      state.enableLocalAuthentication = action.payload;
    },
    setAppLockDuration: (state, action: PayloadAction<number>) => {
      state.appLockDuration = action.payload;
    },
    setSelectedFiatMoneySymbol: (
      state,
      action: PayloadAction<SettingsState['selectedFiatMoneySymbol']>,
    ) => {
      state.selectedFiatMoneySymbol = action.payload;
    },
    setRefreshTS: (state) => {
      state.refreshTimeStamp = getTimeStamp();
    },
    setAutoRefreshTimeStamp: (state) => {
      state.autoRefreshTimeStamp = getTimeStamp();
    },
    setSwapSlippagePercent: (state, action: PayloadAction<string>) => {
      state.swapSlippagePercent = action.payload;
    },
    setOverviewDefiBuildByService: (
      state,
      { payload }: PayloadAction<string>,
    ) => {
      state.devMode = {
        ...state.devMode,
        defiBuildService: payload === 'all' ? undefined : payload,
      };
    },
    setValidationState: (
      state,
      action: PayloadAction<{ key: ValidationFields; value: boolean }>,
    ) => {
      if (!state.validationSetting) {
        state.validationSetting = {};
      }
      const { key, value } = action.payload;
      state.validationSetting[key] = value;
    },
    setDevMode(state, action: PayloadAction<boolean>) {
      state.devMode = { ...state.devMode, enable: action.payload };
    },
    setPreReleaseUpdate(state, action: PayloadAction<boolean>) {
      state.devMode = { ...state.devMode, preReleaseUpdate: action.payload };
    },
    setUpdateDeviceBle(state, action: PayloadAction<boolean>) {
      state.devMode = { ...state.devMode, updateDeviceBle: action.payload };
    },
    setUpdateDeviceSys(state, action: PayloadAction<boolean>) {
      state.devMode = { ...state.devMode, updateDeviceSys: action.payload };
    },
    setUpdateDeviceRes(state, action: PayloadAction<boolean>) {
      state.devMode = { ...state.devMode, updateDeviceRes: action.payload };
    },
    setHideDiscoverContent(state, action: PayloadAction<boolean>) {
      state.devMode = { ...state.devMode, hideDiscoverContent: action.payload };
    },
    setOnRamperTestMode(state, action: PayloadAction<boolean>) {
      state.devMode = {
        ...state.devMode,
        onRamperTestMode: action.payload,
      };
    },
    setShowWebEmbedWebviewAgent(state, action: PayloadAction<boolean>) {
      state.devMode = {
        ...state.devMode,
        showWebEmbedWebviewAgent: action.payload,
      };
    },
    setShowContentScriptReloadButton(state, action: PayloadAction<boolean>) {
      state.devMode = {
        ...state.devMode,
        showContentScriptReloadButton: action.payload,
      };
    },
    setEnableTestFiatEndpoint(state, action: PayloadAction<boolean>) {
      state.devMode = {
        ...state.devMode,
        enableTestFiatEndpoint: action.payload,
      };
    },
    setEnableZeroNotificationThreshold(state, action: PayloadAction<boolean>) {
      state.devMode = {
        ...state.devMode,
        enableZeroNotificationThreshold: action.payload,
      };
    },
    setEnablePerfCheck(state, action: PayloadAction<boolean>) {
      state.devMode = {
        ...state.devMode,
        enablePerfCheck: action.payload,
      };
    },
    setDeviceUpdates(
      state,
      action: PayloadAction<{
        connectId: string;
        type: FirmwareType;
        value: Partial<FirmwareUpdate>;
      }>,
    ) {
      const updateValue =
        action.payload.type === 'firmware'
          ? {
              forceFirmware: action.payload.value.forceFirmware,
              firmware: action.payload.value.firmware,
            }
          : {
              forceBle: action.payload.value.forceBle,
              ble: action.payload.value.ble,
            };
      const currentValue =
        state.deviceUpdates?.[action.payload.connectId] ?? {};

      const newValue = {
        ...currentValue,
        ...updateValue,
      };

      if (!equalFirmwareUpdate(currentValue, newValue)) {
        state.deviceUpdates = {
          ...state.deviceUpdates,
          [action.payload.connectId]: newValue,
        } as Record<string, FirmwareUpdate>;
      }
    },
    setDeviceDoneUpdate(
      state,
      action: PayloadAction<{ connectId: string; type: FirmwareType }>,
    ) {
      if (!state.deviceUpdates) return;

      const { connectId, type } = action.payload;
      if (type === 'firmware') {
        state.deviceUpdates[connectId].forceFirmware = false;
        state.deviceUpdates[connectId].firmware = undefined;
      } else if (type === 'ble') {
        state.deviceUpdates[connectId].forceBle = false;
        state.deviceUpdates[connectId].ble = undefined;
      }
    },
    setEnableHaptics(state, action: PayloadAction<boolean>) {
      state.enableHaptics = action.payload;
    },
    setHideSmallBalance(state, action: PayloadAction<boolean>) {
      state.hideSmallBalance = action.payload;
    },
    setHideScamHistory(state, action: PayloadAction<boolean>) {
      state.hideScamHistory = action.payload;
    },
    setHideRiskTokens(state, action: PayloadAction<boolean>) {
      state.hideRiskTokens = action.payload;
    },
    setPutMainTokenOnTop(state, action: PayloadAction<boolean>) {
      state.putMainTokenOnTop = action.payload;
    },
    setHideBalance(state, action: PayloadAction<boolean>) {
      state.hideBalance = action.payload;
    },
    setIncludeNFTsInTotal(state, action: PayloadAction<boolean>) {
      state.includeNFTsInTotal = action.payload;
    },
    setPushNotificationConfig(
      state,
      action: PayloadAction<Partial<SettingsState['pushNotification']>>,
    ) {
      const config = {
        ...defaultPushNotification,
        ...state.pushNotification,
        ...action.payload,
      };
      if (action.payload?.pushEnable && !state.pushNotification?.pushEnable) {
        Object.assign(config, {
          priceAlertEnable: true,
          btcAndEthPriceAlertEnable: true,
          favoriteTokensPriceAlertEnable: true,
          accountActivityPushEnable: true,
        });
      }
      state.pushNotification = config;
    },
    setUpdateSetting(
      state,
      action: PayloadAction<Partial<SettingsState['updateSetting']>>,
    ) {
      const setting = {
        ...state.updateSetting,
        ...action.payload,
      };
      state.updateSetting = setting as SettingsState['updateSetting'];
    },
    setDisableSwapExactApproveAmount(state, action: PayloadAction<boolean>) {
      state.disableSwapExactApproveAmount = action.payload;
    },
    updateCustomNetworkRpc: (
      state,
      action: PayloadAction<{
        networkId: string;
        type: 'add' | 'remove';
        rpc: string;
      }>,
    ) => {
      const { type, networkId, rpc } = action.payload;
      const map = {
        ...(state.customNetworkRpcMap || {}),
      };
      if (!Array.isArray(map[networkId])) {
        map[networkId] = [];
      }
      if (type === 'add') {
        map[networkId].push(rpc);
        map[networkId] = uniq(map[networkId]);
      } else if (type === 'remove') {
        map[networkId] = map[networkId].filter((n) => n !== rpc);
      }
      state.customNetworkRpcMap = map;
    },
    clearNetworkCustomRpcs(
      state,
      action: PayloadAction<{ networkId: string }>,
    ) {
      const { networkId } = action.payload;
      const map = {
        ...(state.customNetworkRpcMap || {}),
      };
      delete map[networkId];
      state.customNetworkRpcMap = map;
    },
    setEnableWebAuthn(state, action: PayloadAction<boolean>) {
      state.enableWebAuthn = action.payload;
    },
    toggleDisableExt(state) {
      state.disableExt = !state.disableExt;
    },
    disableExtSwitchTips(state) {
      state.disableExtSwitchTips = true;
    },
    setWalletSwitch(
      state,
      action: PayloadAction<Record<string, WalletSwitchItem>>,
    ) {
      const { payload } = action;
      const stateWalletSwitch = state.walletSwitchData || {};
      const walletSwitch = {
        ...payload,
        ...stateWalletSwitch,
      };
      state.walletSwitchData = walletSwitch;
    },
    toggleWalletSwitch(
      state,
      action: PayloadAction<{ walletId: string; enable: boolean }>,
    ) {
      const { walletId, enable } = action.payload;
      const stateWalletSwitch = state.walletSwitchData || {};
      const cacheWalletSwitch = stateWalletSwitch[walletId] || {};
      cacheWalletSwitch.enable = enable;
    },
    setAccountDerivationDbMigrationVersion(
      state,
      action: PayloadAction<string>,
    ) {
      state.accountDerivationDbMigrationVersion = action.payload;
    },
    rememberPassphraseWallet(state, action: PayloadAction<string>) {
      const { payload } = action;
      const rememberWallets = state.hardware?.rememberPassphraseWallets || [];
      if (!rememberWallets.includes(payload)) {
        rememberWallets.push(payload);
      }

      state.hardware = {
        ...state.hardware,
        rememberPassphraseWallets: rememberWallets,
      };
    },
    forgetPassphraseWallet(state, action: PayloadAction<string | string[]>) {
      const { payload } = action;
      const rememberWallets = state.hardware?.rememberPassphraseWallets || [];
      const pendingDelete = Array.isArray(payload) ? payload : [payload];

      pendingDelete.forEach((walletId) => {
        const index = rememberWallets.indexOf(walletId);
        if (index > -1) {
          rememberWallets.splice(index, 1);
        }
      });

      state.hardware = {
        ...state.hardware,
        rememberPassphraseWallets: rememberWallets,
      };
    },
    setVerification: (
      state,
      action: PayloadAction<{ connectId: string; verified: boolean }>,
    ) => {
      state.hardware = {
        ...state.hardware,
        verification: {
          ...state.hardware?.verification,
          [action.payload.connectId]: action.payload.verified,
        },
      };
    },
    setDeviceVersion: (
      state,
      action: PayloadAction<{ connectId: string; version: string }>,
    ) => {
      state.hardware = {
        ...state.hardware,
        versions: {
          ...state.hardware?.versions,
          [action.payload.connectId]: action.payload.version,
        },
      };
    },
    setForceUpdateVersionInfo: (
      state,
      action: PayloadAction<VersionInfo | undefined>,
    ) => {
      state.softwareUpdate = {
        ...state.softwareUpdate,
        forceUpdateVersionInfo: action.payload,
      };
    },
    setLeftSidebarCollapsed(state, action: PayloadAction<boolean>) {
      state.leftSidebarCollapsed = action.payload;
    },
    setEnableETH2Unstake(state, action: PayloadAction<boolean>) {
      state.enableETH2Unstake = action.payload;
    },
    setAdvancedSettings(
      state,
      action: PayloadAction<SettingsState['advancedSettings']>,
    ) {
      const prevSettings = state.advancedSettings ?? {};
      state.advancedSettings = {
        ...prevSettings,
        ...action.payload,
      };
    },
    setHardwareConnectSrc(
      state,
      action: PayloadAction<SettingsState['hardwareConnectSrc']>,
    ) {
      state.hardwareConnectSrc = action.payload;
    },
    setGasPanelEIP1559Enabled(state, action: PayloadAction<boolean>) {
      state.gasPanelEIP1559Enabled = action.payload;
    },
    setShowTokenDetailPriceChart(state, action: PayloadAction<boolean>) {
      state.showTokenDetailPriceChart = action.payload;
    },
    setHideAllNetworksSelectNetworkTips(state, action: PayloadAction<boolean>) {
      state.hideAllNetworksSelectNetworkTips = action.payload;
    },
  },
});

export const {
  setTheme,
  setLocale,
  setEnableAppLock,
  toggleEnableLocalAuthentication,
  setSelectedFiatMoneySymbol,
  setRefreshTS,
  setAppLockDuration,
  setAutoRefreshTimeStamp,
  updateVersionAndBuildNumber,
  setEnableLocalAuthentication,
  setSwapSlippagePercent,
  setValidationState,
  setEnableTestFiatEndpoint,
  setDevMode,
  setPreReleaseUpdate,
  setUpdateDeviceBle,
  setUpdateDeviceSys,
  setUpdateDeviceRes,
  setDeviceUpdates,
  setDeviceDoneUpdate,
  setEnableHaptics,
  setHideSmallBalance,
  setPushNotificationConfig,
  setEnableZeroNotificationThreshold,
  setEnablePerfCheck,
  setIncludeNFTsInTotal,
  setHideBalance,
  setUpdateSetting,
  setDisableSwapExactApproveAmount,
  updateCustomNetworkRpc,
  setHideRiskTokens,
  setEnableWebAuthn,
  toggleDisableExt,
  disableExtSwitchTips,
  setPutMainTokenOnTop,
  setOverviewDefiBuildByService,
  setHideDiscoverContent,
  setWalletSwitch,
  toggleWalletSwitch,
  setHideScamHistory,
  setAccountDerivationDbMigrationVersion,
  setOnRamperTestMode,
  setShowWebEmbedWebviewAgent,
  setShowContentScriptReloadButton,
  clearNetworkCustomRpcs,
  rememberPassphraseWallet,
  forgetPassphraseWallet,
  setVerification,
  setDeviceVersion,
  setForceUpdateVersionInfo,
  setLeftSidebarCollapsed,
  setEnableETH2Unstake,
  setAdvancedSettings,
  setHardwareConnectSrc,
  setGasPanelEIP1559Enabled,
  setShowTokenDetailPriceChart,
  setHideAllNetworksSelectNetworkTips,
} = settingsSlice.actions;

export default settingsSlice.reducer;
