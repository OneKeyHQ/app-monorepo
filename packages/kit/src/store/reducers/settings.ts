import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import uuid from 'react-native-uuid';

import { LocaleSymbol } from '@onekeyhq/components/src/locale';
import { ThemeVariant } from '@onekeyhq/components/src/Provider/theme';
import { getTimeStamp } from '@onekeyhq/kit/src/utils/helper';
import type { FirmwareType } from '@onekeyhq/kit/src/views/Hardware/UpdateFirmware/Updating';
import { defaultHapticStatus } from '@onekeyhq/shared/src/haptics';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ValidationFields } from '../../components/Protected/types';

import type {
  BLEFirmwareInfo,
  SYSFirmwareInfo,
} from '../../utils/updates/type';

export type FirmwareUpdate = {
  forceFirmware: boolean;
  forceBle: boolean;
  firmware?: SYSFirmwareInfo;
  ble?: BLEFirmwareInfo;
};

type SettingsState = {
  theme: ThemeVariant | 'system';
  locale: LocaleSymbol;
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
  enableHaptics: boolean;
  deviceUpdates?: Record<
    string, // connectId
    FirmwareUpdate
  >;
  devMode: {
    enable: boolean;
    preReleaseUpdate: boolean;
    updateDeviceBle: boolean;
    updateDeviceSys: boolean;
  };
  validationSetting: {
    [ValidationFields.Account]?: boolean;
    [ValidationFields.Payment]?: boolean;
    [ValidationFields.Secret]?: boolean;
    [ValidationFields.Wallet]?: boolean;
  };
};

const initialState: SettingsState = {
  theme: 'system',
  locale: 'system',
  version: process.env.VERSION ?? '1.0.0',
  buildNumber: process.env.BUILD_NUMBER ?? '2022010100',
  instanceId: uuid.v4() as string,
  enableAppLock: false,
  enableLocalAuthentication: false,
  appLockDuration: 240,
  enableHaptics: defaultHapticStatus,
  selectedFiatMoneySymbol: 'usd',
  refreshTimeStamp: getTimeStamp(),
  autoRefreshTimeStamp: getTimeStamp(),
  swapSlippagePercent: '3',
  deviceUpdates: {},
  devMode: {
    enable: false,
    preReleaseUpdate: false,
    updateDeviceBle: false,
    updateDeviceSys: false,
  },
  validationSetting: {
    [ValidationFields.Account]: false,
    [ValidationFields.Payment]: false,
    [ValidationFields.Secret]: false,
    [ValidationFields.Wallet]: false,
  },
};

export const THEME_PRELOAD_STORAGE_KEY = 'ONEKEY_THEME_PRELOAD';
export function setThemePreloadToLocalStorage(
  value: string,
  forceUpdate = true,
) {
  try {
    const key = THEME_PRELOAD_STORAGE_KEY;
    if (platformEnv.isRuntimeBrowser) {
      if (forceUpdate || !localStorage.getItem(key)) {
        localStorage.setItem(key, value);
      }
    }
  } catch (error) {
    console.error(error);
  }
}
setThemePreloadToLocalStorage(initialState.theme, false);

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
    setLocale: (state, action: PayloadAction<LocaleSymbol>) => {
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
    setDeviceUpdates(
      state,
      action: PayloadAction<{ connectId: string; value: FirmwareUpdate }>,
    ) {
      state.deviceUpdates = {
        ...state.deviceUpdates,
        [action.payload.connectId]: action.payload.value,
      };
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
    setEnableHaptics(state) {
      state.enableHaptics = !state.enableHaptics;
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
  setDevMode,
  setPreReleaseUpdate,
  setUpdateDeviceBle,
  setUpdateDeviceSys,
  setDeviceUpdates,
  setDeviceDoneUpdate,
  setEnableHaptics,
} = settingsSlice.actions;

export default settingsSlice.reducer;
