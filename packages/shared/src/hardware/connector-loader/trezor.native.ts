import { logHwk } from '../hwkLogger';

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
    // Wire the same redacting logger as desktop so the rn-ble transport's
    // scan/connect dumps AND its native BLE logs surface in the hardware SDK
    // logger. Without it the connector is silent by construction.
    transportOptions: { manager: manager as never, logger: logHwk },
    thp: {
      hostName: 'OneKey',
      appName: 'OneKey Wallet',
      logger: logHwk,
    },
  });
};
