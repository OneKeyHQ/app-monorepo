import type { IConnector } from '@onekeyfe/hwk-adapter-core';

// Native (iOS/Android): Trezor Safe 7 over BLE via react-native-ble-plx.
// The connector owns a BleManager internally; the OneKey HW BLE path uses a
// separate manager, which is fine — react-native-ble-plx is safe to
// instantiate multiple times.
export const createTrezorConnector = async (): Promise<IConnector> => {
  const [{ createTrezorRnBleConnector }, { BleManager }] = await Promise.all([
    import('@onekeyfe/hwk-trezor-connector-rn-ble'),
    import('react-native-ble-plx'),
  ]);
  const manager = new BleManager();
  return createTrezorRnBleConnector({
    transportOptions: { manager: manager as never },
    thp: {
      hostName: 'OneKey',
      appName: 'OneKey Wallet',
    },
  });
};
