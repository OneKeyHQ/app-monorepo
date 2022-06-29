import {
  IDeviceType,
  SearchDevice,
  Success,
  Unsuccessful,
  getDeviceType,
} from '@onekeyfe/hd-core';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types';

import { getBondedDevices } from './BleManager';
import { getHardwareSDKInstance } from './hardwareInstance';

/**
 * will delete packages/kit/src/utils/device
 * so declare it here
 */

type IPollFn<T> = (time?: number) => T;

const MAX_SEARCH_TRY_COUNT = 15;
const MAX_CONNECT_TRY_COUNT = 5;
const POLL_INTERVAL = 1000;
const POLL_INTERVAL_RATE = 1.5;

export enum DeviceErrors {
  ConnectTimeout = 'ConnectTimeout',
  NeedOneKeyBridge = 'NeedOneKeyBridge',
  DeviceNotBonded = 'DeviceNotBonded',
}

class DeviceUtils {
  connectedDeviceType: IDeviceType = 'classic';

  scanning = false;

  tryCount = 0;

  checkBonded = false;

  async getSDKInstance() {
    return getHardwareSDKInstance();
  }

  startDeviceScan(
    callback: (searchResponse: Unsuccessful | Success<SearchDevice[]>) => void,
  ) {
    const searchDevices = async () => {
      const HardwareSDK = await this.getSDKInstance();
      const searchResponse = await HardwareSDK?.searchDevices();
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
        return Promise.reject(response);
      }

      return new Promise((resolve: (p: void) => void) =>
        setTimeout(() => resolve(poll(time * POLL_INTERVAL_RATE)), time),
      );
    };

    this.scanning = true;
    poll();
  }

  stopScan() {
    this.scanning = false;
    this.tryCount = 0;
  }

  async connect(connectId: string) {
    try {
      const result = await this.getFeaturesWithError(connectId);
      return result !== null;
    } catch (e) {
      if ((e as Error).message.includes('device is not bonded')) {
        return Promise.reject(DeviceErrors.DeviceNotBonded);
      }
    }
  }

  async getFeatures(connectId: string) {
    const HardwareSDK = await this.getSDKInstance();
    const response = await HardwareSDK?.getFeatures(connectId);

    if (response.success) {
      this.connectedDeviceType = getDeviceType(response.payload);
      return response.payload;
    }
    return null;
  }

  async getFeaturesWithError(connectId: string) {
    const HardwareSDK = await this.getSDKInstance();
    const response = await HardwareSDK?.getFeatures(connectId);
    if (response.success) {
      this.connectedDeviceType = getDeviceType(response.payload);
      return response.payload;
    }
    throw new Error(response.payload.error ?? response.payload);
  }

  async ensureConnected(connectId: string) {
    let tryCount = 0;
    let connected = false;
    const poll: IPollFn<Promise<IOneKeyDeviceFeatures>> = async (
      time = POLL_INTERVAL,
    ) => {
      if (connected) {
        return Promise.resolve({} as IOneKeyDeviceFeatures);
      }
      tryCount += 1;
      try {
        const feature = await this.getFeaturesWithError(connectId);
        if (feature) {
          connected = true;
          return await Promise.resolve(feature);
        }
      } catch (e) {
        // stop polling when device is not bonded
        if ((e as Error).message.includes('device is not bonded')) {
          return Promise.reject(DeviceErrors.DeviceNotBonded);
        }
      }

      if (tryCount > MAX_CONNECT_TRY_COUNT) {
        return Promise.reject(DeviceErrors.ConnectTimeout);
      }
      return new Promise(
        (resolve: (p: Promise<IOneKeyDeviceFeatures>) => void) =>
          setTimeout(() => resolve(poll(time * POLL_INTERVAL_RATE)), time),
      );
    };

    const checkBridge = await this.checkBridge();
    if (!checkBridge) {
      return Promise.reject(DeviceErrors.NeedOneKeyBridge);
    }

    return poll();
  }

  async checkDeviceBonded(connectId: string) {
    const poll: IPollFn<Promise<boolean | undefined>> = async (
      time = POLL_INTERVAL,
    ) => {
      if (!this.checkBonded) {
        return;
      }
      const bondedDevices = await getBondedDevices();
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

  stopCheckBonded() {
    this.checkBonded = false;
  }

  async checkBridge() {
    if (!this._hasUseBridge()) {
      return Promise.resolve(true);
    }

    const HardwareSDK = await this.getSDKInstance();
    const transportRelease = await HardwareSDK?.checkTransportRelease();
    return !!transportRelease.success;
  }

  _hasUseBridge() {
    return (
      platformEnv.isDesktop || platformEnv.isWeb || platformEnv.isExtension
    );
  }
}

const deviceUtils = new DeviceUtils();

export default deviceUtils;
