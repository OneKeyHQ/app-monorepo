import {
  IDeviceType,
  SearchDevice,
  Success,
  Unsuccessful,
} from '@onekeyfe/hd-core';
import {
  Deferred,
  HardwareErrorCode,
  createDeferred,
} from '@onekeyfe/hd-shared';
import BleManager from 'react-native-ble-manager';

import backgroundApiProxy from '@onekeyhq//kit/src/background/instance/backgroundApiProxy';
import { ToastManager } from '@onekeyhq/components';
import { LocaleIds } from '@onekeyhq/components/src/locale';
import { formatMessage } from '@onekeyhq/components/src/Provider';
import {
  OneKeyErrorClassNames,
  OneKeyHardwareError,
} from '@onekeyhq/engine/src/errors';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import * as Error from './errors';
import { getHardwareSDKInstance } from './hardwareInstance';

type IPollFn<T> = (time?: number, index?: number) => T;

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

  async getSDKInstance() {
    return getHardwareSDKInstance();
  }

  getBleManager() {
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
  ) {
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
    ) => {
      if (!this.scanMap[searchIndex]) {
        return;
      }
      if (this.tryCount > MAX_SEARCH_TRY_COUNT) {
        this.stopScan();
        return;
      }

      await searchDevices();

      return new Promise((resolve: (p: void) => void) =>
        setTimeout(
          () => resolve(poll(time * POLL_INTERVAL_RATE, searchIndex)),
          time,
        ),
      );
    };

    this.searchIndex += 1;
    this.scanMap[this.searchIndex] = true;
    const time = platformEnv.isNativeAndroid ? 2000 : POLL_INTERVAL;
    poll(time, this.searchIndex);
  }

  stopScan() {
    Object.keys(this.scanMap).forEach(
      (key: string) => (this.scanMap[key] = false),
    );
    this.tryCount = 0;
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
      const hasBonded = !!bondedDevices.find(
        (bondedDevice) => bondedDevice.id === connectId,
      );
      if (hasBonded) {
        this.checkBonded = false;
        return Promise.resolve(true);
      }
      console.log(bondedDevices);

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

  showErrorToast(error: any, defKey?: LocaleIds): boolean {
    const { className, key, code } = error || {};
    if (code === HardwareErrorCode.DeviceInterruptedFromOutside) {
      return false;
    }

    if (className === OneKeyErrorClassNames.OneKeyHardwareError) {
      const { info } = error;

      const errorMessage = formatMessage({ id: key }, info ?? {});

      if (errorMessage) {
        ToastManager.show({ title: errorMessage }, { type: 'error' });
        return true;
      }
    } else {
      const errorMessage = formatMessage({ id: defKey ?? key });

      if (errorMessage) {
        ToastManager.show({ title: errorMessage }, { type: 'error' });
        return true;
      }
    }

    return false;
  }

  convertDeviceError(payload: any): OneKeyHardwareError {
    // handle ext error
    const {
      code,
      error,
      message,
      params: errorParams,
    }: {
      code: number;
      error?: string;
      message?: string;
      params?: any;
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
        return new Error.UnknownHardwareError({ message: msg });
      case HardwareErrorCode.DeviceFwException:
        return new Error.FirmwareVersionTooLow(msg);
      case HardwareErrorCode.DeviceUnexpectedMode:
        if (
          typeof msg === 'string' &&
          msg.indexOf('ui-device_bootloader_mode') !== -1
        ) {
          return new Error.NotInBootLoaderMode();
        }
        return new Error.UnknownHardwareError({ message: msg });
      case HardwareErrorCode.DeviceCheckDeviceIdError:
        return new Error.DeviceNotSame({ message: msg });
      case HardwareErrorCode.DeviceNotFound:
        return new Error.DeviceNotFind({ message: msg });
      case HardwareErrorCode.DeviceUnexpectedBootloaderMode:
        return new Error.NotInBootLoaderMode({ message: msg });
      case HardwareErrorCode.DeviceInterruptedFromOutside:
        return new Error.UserCancelFromOutside({ message: msg });
      case HardwareErrorCode.DeviceInterruptedFromUser:
        return new Error.UserCancelFromOutside({ message: msg });
      case HardwareErrorCode.DeviceNotSupportPassphrase:
        return new Error.NotSupportPassphraseError({ message: msg });
      case HardwareErrorCode.IFrameLoadFail:
        return new Error.InitIframeLoadFail({ message: msg });
      case HardwareErrorCode.IframeTimeout:
        return new Error.InitIframeTimeout({ message: msg });
      case HardwareErrorCode.FirmwareUpdateDownloadFailed:
        return new Error.FirmwareDownloadFailed({ message: msg });
      case HardwareErrorCode.CallMethodNeedUpgradeFirmware:
        return new Error.FirmwareVersionTooLow(msg, errorParams);
      case HardwareErrorCode.NetworkError:
        return new Error.NetworkError({ message: msg });
      case HardwareErrorCode.BlePermissionError:
        return new Error.NeedBluetoothTurnedOn({ message: msg });
      case HardwareErrorCode.BleLocationError:
        return new Error.NeedBluetoothPermissions({ message: msg });
      case HardwareErrorCode.BleDeviceNotBonded:
        return new Error.DeviceNotBonded({ message: msg });
      case HardwareErrorCode.BleWriteCharacteristicError:
        return new Error.BleWriteCharacteristicError({ message: msg });
      case HardwareErrorCode.BleScanError:
        return new Error.BleScanThrottleError({ message: msg });
      case HardwareErrorCode.RuntimeError:
        if (msg.indexOf('EIP712 blind sign is disabled') !== -1) {
          return new Error.OpenBlindSign({ message: msg });
        }
        if (msg.indexOf('Unknown message') !== -1) {
          return new Error.UnknownMethod({ message: msg });
        }
        if (msg.indexOf('Failure_UnexpectedMessage') !== -1) {
          return new Error.UnknownMethod({ message: msg });
        }
        return new Error.UnknownHardwareError({ message: msg });
      case HardwareErrorCode.PinInvalid:
        return new Error.InvalidPIN({ message: msg });
      case HardwareErrorCode.PinCancelled:
      case HardwareErrorCode.ActionCancelled:
        return new Error.UserCancel({ message: msg });
      case HardwareErrorCode.BridgeNotInstalled:
        return new Error.NeedOneKeyBridge({ message: msg });
      case Error.CustomOneKeyHardwareError.NeedOneKeyBridge:
        return new Error.NeedOneKeyBridge({ message: msg });
      case HardwareErrorCode.BridgeNetworkError:
        return new Error.BridgeNetworkError({ message: msg });
      case HardwareErrorCode.BridgeTimeoutError:
        if (platformEnv.isDesktop) {
          debugLogger.hardwareSDK.debug(
            'desktop bridge timeout, restart desktop bridge.',
          );
          window.desktopApi.reloadBridgeProcess();
        }
        return new Error.BridgeTimeoutError({ message: msg });
      case HardwareErrorCode.PollingTimeout:
        return new Error.ConnectTimeoutError({ message: msg });
      default:
        return new Error.UnknownHardwareError({ message: msg });
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
}

const deviceUtils = new DeviceUtils();

export default deviceUtils;
