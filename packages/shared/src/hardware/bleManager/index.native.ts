import BleManager from 'react-native-ble-manager';

import platformEnv from '../../platformEnv';
import { equalsIgnoreCase } from '../../utils/stringUtils';

type IPollFn<T> = (time?: number, index?: number, rate?: number) => T;
const POLL_INTERVAL = 1000;
const POLL_INTERVAL_RATE = 1.5;

class BleManagerInstance {
  bleManager?: typeof BleManager;

  async getBleManager() {
    if (!platformEnv.isNative) return null;
    if (this.bleManager) {
      return Promise.resolve(this.bleManager);
    }
    await BleManager.start({ showAlert: false });
    this.bleManager = BleManager;
  }

  /**
   * get bonded devices (only android)
   * @returns Bound device
   */
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

  async checkDeviceBonded(connectId: string) {
    let retry = 0;
    const maxRetryCount = 5;
    const poll: IPollFn<Promise<boolean | undefined>> = async (
      time = POLL_INTERVAL,
    ) => {
      retry += 1;
      const bondedDevices = await this.getBondedDevices();

      const hasBonded = !!bondedDevices.find((bondedDevice) =>
        equalsIgnoreCase(bondedDevice.id, connectId),
      );

      if (hasBonded) {
        return Promise.resolve(true);
      }

      if (retry > maxRetryCount) {
        return Promise.resolve(false);
      }

      return new Promise((resolve: (p: Promise<boolean | undefined>) => void) =>
        setTimeout(() => resolve(poll(3000 * POLL_INTERVAL_RATE)), time),
      );
    };
    return poll();
  }
}

export default new BleManagerInstance();
