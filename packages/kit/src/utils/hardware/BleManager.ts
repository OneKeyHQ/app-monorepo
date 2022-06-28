import BleManager from 'react-native-ble-manager';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

if (platformEnv.isNative) {
  BleManager.start({ showAlert: false });
}

export const getBondedDevices = async () => {
  const peripherals = await BleManager.getBondedPeripherals();
  return peripherals.map((peripheral) => {
    const { id, name, advertising = {} } = peripheral;
    return { id, name, ...advertising };
  });
};
