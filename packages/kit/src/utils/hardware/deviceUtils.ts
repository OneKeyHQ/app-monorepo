import {
  IDeviceType,
  SearchDevice,
  Success,
  Unsuccessful,
} from '@onekeyfe/hd-core';
import BleManager from 'react-native-ble-manager';

import backgroundApiProxy from '@onekeyhq//kit/src/background/instance/backgroundApiProxy';
import { OneKeyHardwareError } from '@onekeyhq/engine/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  DeviceNotBonded,
  DeviceNotFind,
  FirmwareVersionTooLow,
  InitIframeLoadFail,
  InitIframeTimeout,
  InvalidPIN,
  NeedBluetoothPermissions,
  NeedBluetoothTurnedOn,
  OpenBlindSign,
  UnknownHardwareError,
  UnknownMethod,
  UserCancel,
} from './errors';
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const error = payload?.error ?? payload;
    if (error === null) return new UnknownHardwareError();
    if (typeof error !== 'string') return new UnknownHardwareError();

    if (error.includes('device is not bonded')) {
      return new DeviceNotBonded();
    }

    if (error.includes('Device firmware version is too low')) {
      return new FirmwareVersionTooLow();
    }

    switch (error) {
      case 'Error: Bluetooth required to be turned on':
        return new NeedBluetoothTurnedOn();

      case 'BleError: Device is not authorized to use BluetoothLE':
        return new NeedBluetoothPermissions();

      case 'PIN cancelled':
        return new UserCancel();

      case 'Action cancelled by user':
        return new UserCancel();

      case 'Unknown message':
        return new UnknownMethod();

      case 'Device Not Found':
        return new DeviceNotFind();

      case 'Init_IframeLoadFail':
        return new InitIframeTimeout();

      case 'Init_IframeTimeout':
        return new InitIframeLoadFail();

      case 'PIN码错误':
      case 'PIN invalid':
        return new InvalidPIN();

      case 'EIP712 blind sign is disabled':
        return new OpenBlindSign();

      default:
        return new UnknownHardwareError();
    }
  }
}

const deviceUtils = new DeviceUtils();

export default deviceUtils;
