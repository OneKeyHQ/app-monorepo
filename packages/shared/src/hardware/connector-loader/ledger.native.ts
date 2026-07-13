import type { IConnector } from '@onekeyfe/hwk-adapter-core';

// Native (iOS/Android): Ledger BLE connector from SDK
export const createLedgerConnector = async (): Promise<IConnector> => {
  const { createLedgerBleConnector } =
    await import('@onekeyfe/hwk-ledger-connector-ble');
  return createLedgerBleConnector();
};
