import { type Deferred, createDeferred } from '@onekeyfe/hd-shared';
import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import bluetoothManager from 'react-native-ble-manager';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { poll } from '@onekeyhq/shared/src/utils/polling';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

import type { SearchDevice } from '@onekeyfe/hd-core';

let searchPromise: Deferred<void> | null = null;

class DeviceUtils {
  bluetoothManager?: typeof bluetoothManager;

  async getBluetoothManager() {
    if (!platformEnv.isNative) return null;
    if (this.bluetoothManager) {
      return Promise.resolve(this.bluetoothManager);
    }
    void bluetoothManager.start({ showAlert: false });
    this.bluetoothManager = bluetoothManager;
  }

  pollingSearchDevice(callback: (searchResponse: SearchDevice[]) => void) {
    const searchDevices = async () => {
      if (searchPromise) {
        await searchPromise.promise;
        console.log('search throttling, await search promise and return');
        return;
      }

      searchPromise = createDeferred();

      try {
        const response =
          await backgroundApiProxy.serviceHardware.searchDevices();
        callback(response);
      } finally {
        searchPromise?.resolve();
        searchPromise = null;
        console.log('Search finished, reset search promise');
      }
    };

    let shouldStopPolling = false;
    void poll(
      searchDevices,
      () => 3000,
      () => shouldStopPolling,
    );
    return () => {
      shouldStopPolling = true;
    };
  }

  async getBondedDevices() {
    const bluetoothMgr = await this.getBluetoothManager();
    if (!bluetoothMgr) {
      return [];
    }
    const peripherals = await bluetoothMgr.getBondedPeripherals();
    return peripherals.map((peripheral) => {
      const { id, name, advertising = {} } = peripheral;
      return { id, name, ...advertising };
    });
  }

  async checkDevicePaired(connectId: string) {
    const retryCount = 0;
    let shouldStopPolling = false;
    const MAX_RETRY_COUNT = 10;
    return new Promise<boolean>((resolve) => {
      const checkBonded = async () => {
        if (shouldStopPolling) return;
        const bondedDevices = await this.getBondedDevices();
        const isPaired = !!bondedDevices.find(
          (bondedDevice) =>
            bondedDevice.id?.toLowerCase() === connectId.toLowerCase(),
        );
        if (isPaired) {
          resolve(true);
          shouldStopPolling = true;
          return;
        }
        if (retryCount > MAX_RETRY_COUNT) {
          resolve(false);
          shouldStopPolling = true;
        }
      };

      void poll(
        checkBonded,
        () => 3000,
        () => shouldStopPolling,
      );
    });
  }

  connect(connectId: string) {
    return new Promise((resolve) => {
      backgroundApiProxy.serviceHardware
        .connect(connectId)
        .then(() => {
          resolve(true);
        })
        .catch(async (err: any) => {
          const { code } = err || {};
          // eslint-disable-next-line spellcheck/spell-checker
          if (code === HardwareErrorCode.BleDeviceNotBonded) {
            if (platformEnv.isNativeAndroid) {
              const isPaired = await this.checkDevicePaired(connectId);
              resolve(isPaired);
              return;
            }
          }
          resolve(false);
        });
    });
  }
}

const deviceUtils = new DeviceUtils();
export { deviceUtils };
