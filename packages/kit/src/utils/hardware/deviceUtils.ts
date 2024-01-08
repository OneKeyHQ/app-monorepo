/* eslint-disable no-promise-executor-return */
import { HardwareErrorCode, createDeferred } from '@onekeyfe/hd-shared';
import { isEmpty } from 'lodash';
import BleManager from 'react-native-ble-manager';
import semver from 'semver';

import { ToastManager } from '@onekeyhq/components';
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import { formatMessage } from '@onekeyhq/components/src/Provider';
import type { OneKeyHardwareError } from '@onekeyhq/engine/src/errors';
import { OneKeyErrorClassNames } from '@onekeyhq/engine/src/errors';
import { CoreSDKLoader } from '@onekeyhq/shared/src/device/hardwareInstance';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { toPlainErrorObject } from '@onekeyhq/shared/src/utils/errorUtils';
import { equalsIgnoreCase } from '@onekeyhq/shared/src/utils/stringUtils';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import showHardwarePopup from '../../views/Hardware/PopupHandle/showHardwarePopup';
import { CUSTOM_UI_RESPONSE } from '../../views/Hardware/PopupHandle/showHardwarePopup.consts';

import * as Error from './errors';
import { getDeviceFirmwareVersion } from './OneKeyHardware';

import type { HardwarePopup } from '../../views/Hardware/PopupHandle/showHardwarePopup.consts';
import type { IResourceUpdateInfo, SYSFirmwareInfo } from '../updates/type';
import type {
  Features,
  IDeviceType,
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
    BleManager.start({ showAlert: false });
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
        debugLogger.hardwareSDK.info(
          'search throttling, await search promise and return',
        );
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
        debugLogger.hardwareSDK.info('search finished, reset searchPromise');
      }

      callback(searchResponse as any);

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
      debugLogger.hardwareSDK.info(
        'sync device connect status throttling, await search promise and return',
      );
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
    { uiRequest, payload, content }: HardwarePopup,
    delay = 500,
  ) {
    setTimeout(() => {
      showHardwarePopup({ uiRequest, payload, content });
    }, delay);
  }

  async checkTouchNeedUpdateResource(
    features: Features | undefined,
    firmware: SYSFirmwareInfo,
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

  showErrorToast(error: any, defKey?: LocaleIds): boolean {
    debugLogger.common.info(
      'record showErrorToast handle error:',
      toPlainErrorObject(error),
    );
    console.error('deviceUtils.showErrorToast ERROR: ', error);

    try {
      const { className, key, code, info, message } = error || {};

      if (code === HardwareErrorCode.DeviceInterruptedFromOutside) {
        return false;
      }

      if (code === Error.CustomOneKeyHardwareError.NeedOneKeyBridge) {
        this.delayShowHardwarePopup({
          uiRequest: CUSTOM_UI_RESPONSE.CUSTOM_NEED_ONEKEY_BRIDGE,
        });
        return true;
      }

      if (className === OneKeyErrorClassNames.OneKeyHardwareError) {
        const { data } = error || {};

        const errorMessage = formatMessage({ id: key }, info ?? {});

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
          ToastManager.show({ title: errorMessage }, { type: 'error' });
          return true;
        }
      } else {
        let errorMessage;

        // Ignore key
        const ignoreKeys = ['msg__engine__internal_error', 'onekey_error'];

        if (key && !ignoreKeys.includes(key)) {
          errorMessage = formatMessage({ id: key }, info);
        } else if (defKey) {
          errorMessage = formatMessage({ id: defKey }, info);
        } else if (ignoreKeys.includes(key) && message && !isEmpty(message)) {
          errorMessage = message;
        } else if (key && key !== 'onekey_error') {
          errorMessage = formatMessage({ id: key }, info);
        }

        if (errorMessage) {
          ToastManager.show({ title: errorMessage }, { type: 'error' });
          return true;
        }
      }
    } catch (e: any) {
      debugLogger.common.info(
        'record showErrorToast unexpected error:',
        'unexpected error:',
        toPlainErrorObject(e),
        'handle error:',
        toPlainErrorObject(error),
      );
    }
    return false;
  }

  convertDeviceError(payload: any): OneKeyHardwareError {
    // handle ext error
    const {
      code,
      error,
      message,
    }: {
      code: number;
      error?: string;
      message?: string;
    } = payload || {};

    const msg = error ?? message ?? 'Unknown error';

    /**
     * Catch some special errors
     * they may have multiple error codes
     */
    if (this.caputureSpecialError(code, msg)) {
      return this.caputureSpecialError(code, msg) as Error.ConnectTimeoutError;
    }

    debugLogger.hardwareSDK.info(
      'Device Utils Convert Device Error:',
      code,
      msg,
    );

    switch (code) {
      case HardwareErrorCode.UnknownError:
        return new Error.UnknownHardwareError(payload);
      case HardwareErrorCode.DeviceFwException:
        return new Error.FirmwareVersionTooLow(payload);
      case HardwareErrorCode.DeviceUnexpectedMode:
        if (
          typeof msg === 'string' &&
          msg.indexOf('ui-device_bootloader_mode') !== -1
        ) {
          return new Error.NotInBootLoaderMode(payload);
        }
        return new Error.UnknownHardwareError(payload);
      case HardwareErrorCode.DeviceCheckDeviceIdError:
        return new Error.DeviceNotSame(payload);
      case HardwareErrorCode.DeviceNotFound:
        return new Error.DeviceNotFind(payload);
      case HardwareErrorCode.DeviceUnexpectedBootloaderMode:
        return new Error.NotInBootLoaderMode(payload);
      case HardwareErrorCode.DeviceInterruptedFromOutside:
        return new Error.UserCancelFromOutside(payload);
      case HardwareErrorCode.DeviceInterruptedFromUser:
        return new Error.UserCancelFromOutside(payload);
      case HardwareErrorCode.DeviceNotSupportPassphrase:
        return new Error.NotSupportPassphraseError(payload);
      case HardwareErrorCode.IFrameLoadFail:
        return new Error.InitIframeLoadFail(payload);
      case HardwareErrorCode.IframeTimeout:
        return new Error.InitIframeTimeout(payload);
      case HardwareErrorCode.FirmwareUpdateDownloadFailed:
        return new Error.FirmwareDownloadFailed(payload);
      case HardwareErrorCode.FirmwareUpdateManuallyEnterBoot:
        return new Error.FirmwareUpdateManuallyEnterBoot(payload);
      case HardwareErrorCode.FirmwareUpdateAutoEnterBootFailure:
        return new Error.FirmwareUpdateAutoEnterBootFailure(payload);
      case HardwareErrorCode.FirmwareUpdateLimitOneDevice:
        return new Error.FirmwareUpdateLimitOneDevice(payload);
      case HardwareErrorCode.CallMethodNeedUpgradeFirmware:
        return new Error.FirmwareVersionTooLow(payload);
      case HardwareErrorCode.NewFirmwareUnRelease:
        return new Error.NewFirmwareUnRelease(payload);
      case HardwareErrorCode.NewFirmwareForceUpdate:
        return new Error.NewFirmwareForceUpdate(payload);
      case HardwareErrorCode.NetworkError:
        return new Error.NetworkError(payload);
      case HardwareErrorCode.BlePermissionError:
        return new Error.NeedBluetoothTurnedOn(payload);
      case HardwareErrorCode.BleLocationError:
        return new Error.NeedBluetoothPermissions({ message: msg });
      case HardwareErrorCode.BleLocationServicesDisabled:
        return new Error.BleLocationServiceError({ message: msg });
      case HardwareErrorCode.BleDeviceNotBonded:
        return new Error.DeviceNotBonded(payload);
      case HardwareErrorCode.BleDeviceBondError:
        return new Error.DeviceBondError(payload);
      case HardwareErrorCode.BleWriteCharacteristicError:
        return new Error.BleWriteCharacteristicError(payload);
      case HardwareErrorCode.BleScanError:
        return new Error.BleScanError({ message: msg });
      case HardwareErrorCode.BleAlreadyConnected:
        return new Error.BleAlreadyConnectedError(payload);
      case HardwareErrorCode.RuntimeError:
        if (msg.indexOf('EIP712 blind sign is disabled') !== -1) {
          return new Error.OpenBlindSign(payload);
        }
        if (msg.indexOf('Unknown message') !== -1) {
          return new Error.UnknownMethod(payload);
        }
        if (msg.indexOf('Failure_UnexpectedMessage') !== -1) {
          return new Error.UnknownMethod(payload);
        }
        return new Error.UnknownHardwareError(payload);
      case HardwareErrorCode.PinInvalid:
        return new Error.InvalidPIN(payload);
      case HardwareErrorCode.DeviceCheckPassphraseStateError:
        return new Error.InvalidPassphrase(payload);
      case HardwareErrorCode.DeviceOpenedPassphrase:
        return new Error.DeviceOpenedPassphrase(payload);
      case HardwareErrorCode.DeviceNotOpenedPassphrase:
        return new Error.DeviceNotOpenedPassphrase(payload);
      case HardwareErrorCode.PinCancelled:
      case HardwareErrorCode.ActionCancelled:
        return new Error.UserCancel(payload);
      case HardwareErrorCode.BridgeNotInstalled:
        return new Error.NeedOneKeyBridge(payload);
      case Error.CustomOneKeyHardwareError.NeedOneKeyBridge:
        return new Error.NeedOneKeyBridge(payload);
      case HardwareErrorCode.BridgeNetworkError:
        return new Error.BridgeNetworkError(payload);
      case HardwareErrorCode.BridgeTimeoutError:
        if (platformEnv.isDesktop) {
          debugLogger.hardwareSDK.debug(
            'desktop bridge timeout, restart desktop bridge.',
          );
          window.desktopApi.reloadBridgeProcess();
        }
        return new Error.BridgeTimeoutError(payload);
      case HardwareErrorCode.PollingTimeout:
        return new Error.ConnectTimeoutError(payload);
      case HardwareErrorCode.BlindSignDisabled:
        return new Error.OpenBlindSign(payload);
      case HardwareErrorCode.FileAlreadyExists:
        return new Error.FileAlreadyExistError(payload);
      case HardwareErrorCode.CheckDownloadFileError:
        return new Error.IncompleteFileError(payload);
      case HardwareErrorCode.NotInSigningMode:
        return new Error.NotInSigningModeError(payload);
      default:
        return new Error.UnknownHardwareError(payload);
    }
  }

  caputureSpecialError(code: number, message: string) {
    if (typeof message !== 'string') return null;
    if (
      code === HardwareErrorCode.DeviceInitializeFailed &&
      message.includes('ECONNABORTED')
    ) {
      return new Error.ConnectTimeoutError({ message });
    }
    if (message.includes('Bridge network error')) {
      return new Error.BridgeNetworkError({ message });
    }
    return null;
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
