import BleManager from '@onekeyfe/react-native-ble-utils';

class BleManagerInstance {
  checkState(): Promise<'on' | 'off'> {
    return BleManager.checkState().then((state) =>
      state === 'on' ? 'on' : 'off',
    );
  }

  // debug: all GATT-connected devices + serviceUUIDs (needs ble-utils >= 0.1.6)
  getConnectedPeripheralsDebug(): Promise<unknown[]> {
    return BleManager.getConnectedPeripherals([]);
  }
}

export default new BleManagerInstance();
