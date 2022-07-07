import {
  IDeviceType,
  SearchDevice,
  Success,
  Unsuccessful,
} from '@onekeyfe/hd-core';
import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import BleManager from 'react-native-ble-manager';

import backgroundApiProxy from '@onekeyhq//kit/src/background/instance/backgroundApiProxy';
import { OneKeyHardwareError } from '@onekeyhq/engine/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import * as Error from './errors';
import { getHardwareSDKInstance } from './hardwareInstance';

/**
 * will delete packages/kit/src/utils/device
 * so declare it here
 */

type IPollFn<T> = (time?: number) => T;

const MAX_SEARCH_TRY_COUNT = 15;
const POLL_INTERVAL = 1000;
const POLL_INTERVAL_RATE = 1.5;

class DeviceUtils {
  connectedDeviceType: IDeviceType = 'classic';

  scanning = false;

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
  ) {
    const searchDevices = async () => {
      const searchResponse =
        await backgroundApiProxy.serviceHardware?.searchDevices();
      callback(searchResponse);

      this.tryCount += 1;
      return searchResponse;
    };

    const poll: IPollFn<void> = async (time = POLL_INTERVAL) => {
      if (!this.scanning) {
        return;
      }
      if (this.tryCount > MAX_SEARCH_TRY_COUNT) {
        this.stopScan();
        return;
      }

      const response = await searchDevices();

      if (!response.success) {
        console.log('Device Utils Start Device Scan:', response);

        return Promise.reject(this.convertDeviceError(response.payload));
      }

      return new Promise((resolve: (p: void) => void) =>
        setTimeout(() => resolve(poll(time * POLL_INTERVAL_RATE)), time),
      );
    };

    this.scanning = true;
    const time = platformEnv.isNativeAndroid ? 2000 : POLL_INTERVAL;
    poll(time);
  }

  stopScan() {
    this.scanning = false;
    this.tryCount = 0;
  }

  async checkDeviceBonded(connectId: string) {
    const poll: IPollFn<Promise<boolean | undefined>> = async (
      time = POLL_INTERVAL,
    ) => {
      if (!this.checkBonded) {
        return;
      }
      const bondedDevices = await this.getBondedDevices();
      const hasBonded = !!bondedDevices.find(
        (bondedDevice) => bondedDevice.id === connectId,
      );
      if (hasBonded) {
        this.checkBonded = false;
        return Promise.resolve(true);
      }
      console.log(bondedDevices);
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

  convertDeviceError(payload: any): OneKeyHardwareError {
    // handle ext error
    const { code, error, message } = payload || {};

    const msg = error ?? message ?? 'Unknown error';

    console.log('Device Utils Convert Device Error:', code, msg);

    switch (code) {
      case HardwareErrorCode.UnknownError:
        return new Error.UnknownHardwareError(msg);
      case HardwareErrorCode.DeviceFwException:
        return new Error.FirmwareVersionTooLow(msg);
      case HardwareErrorCode.DeviceUnexpectedMode:
        if (
          typeof msg === 'string' &&
          msg.indexOf('ui-device_bootloader_mode') !== -1
        ) {
          return new Error.NotInBootLoaderMode();
        }
        return new Error.UnknownHardwareError(msg);
      case HardwareErrorCode.DeviceNotFound:
        return new Error.DeviceNotFind(msg);
      case HardwareErrorCode.DeviceUnexpectedBootloaderMode:
        return new Error.NotInBootLoaderMode(msg);
      case HardwareErrorCode.IFrameLoadFail:
        return new Error.InitIframeLoadFail(msg);
      case HardwareErrorCode.IframeTimeout:
        return new Error.InitIframeTimeout(msg);
      case HardwareErrorCode.FirmwareUpdateDownloadFailed:
        return new Error.FirmwareDownloadFailed(msg);
      case HardwareErrorCode.NetworkError:
        return new Error.NetworkError(msg);
      case HardwareErrorCode.BlePermissionError:
        return new Error.NeedBluetoothTurnedOn(msg);
      case HardwareErrorCode.BleLocationError:
        return new Error.NeedBluetoothPermissions(msg);
      case HardwareErrorCode.BleDeviceNotBonded:
        return new Error.DeviceNotBonded(msg);
      case HardwareErrorCode.RuntimeError:
        if (msg === 'EIP712 blind sign is disabled') {
          return new Error.OpenBlindSign(msg);
        }
        if (msg === 'Unknown message') {
          return new Error.UnknownMethod(msg);
        }
        return new Error.UnknownHardwareError(msg);
      case HardwareErrorCode.PinInvalid:
        return new Error.InvalidPIN(msg);
      case HardwareErrorCode.PinCancelled:
      case HardwareErrorCode.ActionCancelled:
        return new Error.UserCancel(msg);
      case Error.CustomOneKeyHardwareError.NeedOneKeyBridge:
        return new Error.NeedOneKeyBridge(msg);
      default:
        return new Error.UnknownHardwareError(msg);
    }
  }
}

const deviceUtils = new DeviceUtils();

export default deviceUtils;
