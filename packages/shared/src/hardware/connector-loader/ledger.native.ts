import type { IConnector } from '@bytezhang/hardware-wallet-core';

// Native (iOS/Android): Ledger BLE connector from SDK
export const createLedgerConnector = async (): Promise<IConnector> => {
  const { createLedgerBleConnector } =
    await import('@bytezhang/hardware-ledger-connector-ble');
  return createLedgerBleConnector();
};
