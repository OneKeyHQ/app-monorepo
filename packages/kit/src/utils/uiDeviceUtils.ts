/* eslint-disable spellcheck/spell-checker */
/* eslint-disable no-promise-executor-return */
import { HardwareErrorCode, createDeferred } from '@onekeyfe/hd-shared';
import BleManager from 'react-native-ble-manager';
import semver from 'semver';

import { Toast } from '@onekeyhq/components';
import {
  ECustomOneKeyHardwareError,
  EOneKeyErrorClassNames,
} from '@onekeyhq/shared/src/errors/types/errorTypes';
import { CoreSDKLoader } from '@onekeyhq/shared/src/hardware/instance';
import type { ILocaleIds } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { equalsIgnoreCase } from '@onekeyhq/shared/src/utils/stringUtils';
import type { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types';
import {
  CUSTOM_UI_RESPONSE,
  type IHardwarePopup,
  type IResourceUpdateInfo,
  type ISYSFirmwareInfo,
} from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import type {
  Features,
  IDeviceType,
  IVersionArray,
  SearchDevice,
  Success,
  Unsuccessful,
} from '@onekeyfe/hd-core';
import type { Deferred } from '@onekeyfe/hd-shared';

type IPollFn<T> = (time?: number, index?: number, rate?: number) => T;

const MAX_SEARCH_TRY_COUNT = 15;
const POLL_INTERVAL = 1000;
const POLL_INTERVAL_RATE = 1.5;

let searchPromise: Deferred<void> | null = null;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function showHardwarePopup({ uiRequest, payload, content }: IHardwarePopup) {
  console.log('showHardwarePopup');
}

export const getDeviceFirmwareVersion = (
  features: IOneKeyDeviceFeatures | undefined,
): IVersionArray => {
  if (!features) return [0, 0, 0];

  if (features.onekey_version) {
    return features.onekey_version.split('.') as unknown as IVersionArray;
  }
  return [
    features.major_version,
    features.minor_version,
    features.patch_version,
  ];
};

class DeviceUtils {
  connectedDeviceType: IDeviceType = 'classic';

  scanMap: Record<string, boolean> = {};

  searchIndex = 0;

  tryCount = 0;

  checkBonded = false;

  bleManager?: typeof BleManager;

  async getBleManager() {
    if (!platformEnv.isNative) return null;
    if (this.bleManager) {
      return Promise.resolve(this.bleManager);
    }
    await BleManager.start({ showAlert: false });
    this.bleManager = BleManager;
  }

  startDeviceScan(
    callback: (searchResponse: Unsuccessful | Success<SearchDevice[]>) => void,
    onSearchStateChange: (state: 'start' | 'stop') => void,
    pollIntervalRate = POLL_INTERVAL_RATE,
    pollInterval = POLL_INTERVAL,
    maxTryCount = MAX_SEARCH_TRY_COUNT,
  ) {
    const MaxTryCount = maxTryCount ?? MAX_SEARCH_TRY_COUNT;
    const searchDevices = async () => {
      // Should search Throttling
      if (searchPromise) {
        await searchPromise.promise;
        return;
      }

      searchPromise = createDeferred();
      onSearchStateChange('start');

      let searchResponse;
      try {
        searchResponse =
          await backgroundApiProxy.serviceHardware?.searchDevices();
      } finally {
        searchPromise?.resolve();
        searchPromise = null;
      }

      callback(searchResponse);

      this.tryCount += 1;
      onSearchStateChange('stop');
      return searchResponse;
    };

    const poll: IPollFn<void> = async (
      time = POLL_INTERVAL,
      searchIndex = 0,
      rate = POLL_INTERVAL_RATE,
    ) => {
      if (!this.scanMap[searchIndex]) {
        return;
      }
      if (this.tryCount > MaxTryCount) {
        this.stopScan();
        return;
      }

      await searchDevices();
      return new Promise((resolve: (p: void) => void) =>
        setTimeout(() => resolve(poll(time * rate, searchIndex, rate)), time),
      );
    };

    this.searchIndex += 1;
    this.scanMap[this.searchIndex] = true;
    const time = platformEnv.isNativeAndroid
      ? 2000
      : pollInterval ?? POLL_INTERVAL;
    const rate = pollIntervalRate ?? POLL_INTERVAL_RATE;
    poll(time, this.searchIndex, rate);
  }

  stopScan() {
    Object.keys(this.scanMap).forEach(
      (key: string) => (this.scanMap[key] = false),
    );
    this.tryCount = 0;
  }

  /**
   * For USB connections, just call the searchDevice api,
   * capture the connection status via events.
   *
   * For Bluetooth connections, events will be sended in ble-transport.
   */
  async syncDeviceConnectStatus() {
    if (platformEnv.isNative) return;
    if (searchPromise) {
      await searchPromise.promise;
      return;
    }

    searchPromise = createDeferred();
    try {
      await backgroundApiProxy.serviceHardware.searchDevices();
    } finally {
      searchPromise.resolve();
      searchPromise = null;
    }
  }

  async checkDeviceBonded(connectId: string) {
    let retry = 0;
    const maxRetryCount = 5;
    const poll: IPollFn<Promise<boolean | undefined>> = async (
      time = POLL_INTERVAL,
    ) => {
      if (!this.checkBonded) {
        return;
      }
      retry += 1;
      const bondedDevices = await this.getBondedDevices();
      const hasBonded = !!bondedDevices.find((bondedDevice) =>
        equalsIgnoreCase(bondedDevice.id, connectId),
      );
      if (hasBonded) {
        this.checkBonded = false;
        return Promise.resolve(true);
      }

      if (retry > maxRetryCount) {
        this.checkBonded = false;
        return Promise.resolve(false);
      }

      return new Promise((resolve: (p: Promise<boolean | undefined>) => void) =>
        setTimeout(() => resolve(poll(3000 * POLL_INTERVAL_RATE)), time),
      );
    };
    this.checkBonded = true;
    return poll();
  }

  async getBondedDevices() {
    const bleManager = await this.getBleManager();
    if (!bleManager) {
      return [];
    }
    const peripherals = await bleManager.getBondedPeripherals();
    return peripherals.map((peripheral) => {
      const { id, name, advertising = {} } = peripheral;
      return { id, name, ...advertising };
    });
  }

  stopCheckBonded() {
    this.checkBonded = false;
  }

  delayShowHardwarePopup(
    { uiRequest, payload, content }: IHardwarePopup,
    delay = 500,
  ) {
    setTimeout(() => {
      showHardwarePopup({ uiRequest, payload, content });
    }, delay);
  }

  async checkTouchNeedUpdateResource(
    features: Features | undefined,
    firmware: ISYSFirmwareInfo,
  ): Promise<IResourceUpdateInfo> {
    const { getDeviceType } = await CoreSDKLoader();
    const deviceType = getDeviceType(features);
    const { version, fullResourceRange = ['3.5.0', '3.5.0'] } = firmware;
    if (deviceType !== 'touch') return { error: null, needUpdate: false };
    const currentVersion = getDeviceFirmwareVersion(features).join('.');
    const targetVersion = version.join('.');
    const [minVersion, limitVersion] = fullResourceRange;
    if (
      semver.lt(currentVersion, minVersion) &&
      semver.gte(targetVersion, limitVersion)
    ) {
      return {
        error: !platformEnv.isDesktop ? 'USE_DESKTOP' : null,
        needUpdate: true,
        minVersion,
        limitVersion,
      };
    }

    return { error: null, needUpdate: false };
  }

  showErrorToast(error: any, defKey?: ILocaleIds): boolean {
    console.error('deviceUtils.showErrorToast ERROR: ', error);

    try {
      const { className, key, code, info } = error || {};

      if (code === HardwareErrorCode.DeviceInterruptedFromOutside) {
        return false;
      }

      if (code === ECustomOneKeyHardwareError.NeedOneKeyBridge) {
        this.delayShowHardwarePopup({
          uiRequest: CUSTOM_UI_RESPONSE.CUSTOM_NEED_ONEKEY_BRIDGE,
        });
        return true;
      }

      if (className === EOneKeyErrorClassNames.OneKeyHardwareError) {
        const { data } = error || {};

        const errorMessage = appLocale.intl.formatMessage(
          { id: key },
          info ?? {},
        );

        const { connectId, deviceId } = data || {};

        if (connectId && code === HardwareErrorCode.NewFirmwareForceUpdate) {
          this.delayShowHardwarePopup({
            uiRequest: CUSTOM_UI_RESPONSE.CUSTOM_FORCE_UPGRADE_FIRMWARE,
            payload: {
              deviceId,
              deviceConnectId: connectId,
            },
            content: errorMessage,
          });
          return true;
        }

        if (connectId && deviceId) {
          if (
            code === HardwareErrorCode.CallMethodNeedUpgradeFirmware ||
            code === HardwareErrorCode.DeviceNotSupportPassphrase
          ) {
            this.delayShowHardwarePopup({
              uiRequest: CUSTOM_UI_RESPONSE.CUSTOM_NEED_UPGRADE_FIRMWARE,
              payload: {
                deviceId,
                deviceConnectId: connectId,
              },
              content: errorMessage,
            });
            return true;
          }

          if (code === HardwareErrorCode.DeviceOpenedPassphrase) {
            this.delayShowHardwarePopup({
              uiRequest: CUSTOM_UI_RESPONSE.CUSTOM_NEED_CLOSE_PASSPHRASE,
              payload: {
                deviceId,
                deviceConnectId: connectId,
              },
              content: errorMessage,
            });
            return true;
          }

          if (code === HardwareErrorCode.DeviceNotOpenedPassphrase) {
            this.delayShowHardwarePopup({
              uiRequest: CUSTOM_UI_RESPONSE.CUSTOM_NEED_OPEN_PASSPHRASE,
              payload: {
                deviceId,
                deviceConnectId: connectId,
              },
              content: errorMessage,
            });
            return true;
          }
        }

        if (errorMessage) {
          Toast.error({
            title: errorMessage,
          });
          return true;
        }
      } else {
        let errorMessage;

        // Ignore key
        const ignoreKeys = ['msg__engine__internal_error', 'onekey_error'];

        if (key && !ignoreKeys.includes(key)) {
          errorMessage = appLocale.intl.formatMessage({ id: key }, info);
        } else if (defKey) {
          errorMessage = appLocale.intl.formatMessage({ id: defKey }, info);
          // } else if (message && !isEmpty(message)) {
          //   errorMessage = message;
        } else if (key && key !== 'onekey_error') {
          errorMessage = appLocale.intl.formatMessage({ id: key }, info);
        }

        if (errorMessage) {
          Toast.error({
            title: errorMessage,
          });
          return true;
        }
      }
    } catch (e: any) {
      console.error(e);
    }
    return false;
  }

  detectIsPublicBetaTouch(serialNo?: string, version?: string) {
    if (!serialNo) return false;
    const deviceShortType = serialNo.slice(0, 2);
    const buildDate = serialNo.slice(7, 15);
    const buildDataNum = Number(buildDate);
    // Build date before 2022.10.20 and firmware version lower than 3.3.0
    const publicBetaEnd = 20221020;
    if (deviceShortType?.toUpperCase?.() !== 'TC') return false;
    if (buildDataNum < publicBetaEnd && semver.gt('3.3.0', version ?? '3.3.0'))
      return true;
    return false;
  }
}

const deviceUtils = new DeviceUtils();

export default deviceUtils;
