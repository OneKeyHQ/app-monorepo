import { type Deferred, createDeferred } from '@onekeyfe/hd-shared';
import BlueToothManager from 'react-native-ble-manager';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { poll } from '../helper';

import type { SearchDevice } from '@onekeyfe/hd-core';

let searchPromise: Deferred<void> | null = null;

class DeviceUtils {
  blueToothManager?: typeof BlueToothManager;

  async getBleManager() {
    if (!platformEnv.isNative) return null;
    if (this.blueToothManager) {
      return Promise.resolve(this.blueToothManager);
    }
    void BlueToothManager.start({ showAlert: false });
    this.blueToothManager = BlueToothManager;
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
}

const deviceUtils = new DeviceUtils();
export { deviceUtils };
