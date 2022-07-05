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
    const { code, error } = payload;
    console.log('Device Utils Convert Device Error:', code, error);

    switch (code) {
      case HardwareErrorCode.UnknownError:
        return new Error.UnknownHardwareError();
      case HardwareErrorCode.DeviceFwException:
        return new Error.FirmwareVersionTooLow();
      case HardwareErrorCode.DeviceNotFound:
        return new Error.DeviceNotFind();
      case HardwareErrorCode.DeviceUnexpectedBootloaderMode:
        return new Error.NotInBootLoaderMode();
      case HardwareErrorCode.IFrameLoadFail:
        return new Error.InitIframeLoadFail();
      case HardwareErrorCode.IframeTimeout:
        return new Error.InitIframeTimeout();
      case HardwareErrorCode.FirmwareUpdateDownloadFailed:
        return new Error.FirmwareDownloadFailed();
      case HardwareErrorCode.NetworkError:
        return new Error.NetworkError();
      case HardwareErrorCode.BlePermissionError:
        return new Error.NeedBluetoothTurnedOn();
      case HardwareErrorCode.BleLocationError:
        return new Error.NeedBluetoothPermissions();
      case HardwareErrorCode.BleDeviceNotBonded:
        return new Error.DeviceNotBonded();
      case HardwareErrorCode.RuntimeError:
        if (error === 'EIP712 blind sign is disabled') {
          return new Error.OpenBlindSign();
        }
        if (error === 'Unknown message') {
          return new Error.UnknownMethod();
        }
        return new Error.UnknownHardwareError(error);
      case HardwareErrorCode.PinInvalid:
        return new Error.InvalidPIN();
      case HardwareErrorCode.PinCancelled:
      case HardwareErrorCode.ActionCancelled:
        return new Error.UserCancel();
      default:
        return new Error.UnknownHardwareError(error);
    }
  }
}

const deviceUtils = new DeviceUtils();

export default deviceUtils;
