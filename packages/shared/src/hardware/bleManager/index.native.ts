import BleManager from '@onekeyfe/react-native-ble-utils';

class BleManagerInstance {
  checkState(): Promise<'on' | 'off'> {
    return BleManager.checkState().then((state) =>
      state === 'on' ? 'on' : 'off',
    );
  }
}

export default new BleManagerInstance();
