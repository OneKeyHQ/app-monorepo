import type { IConnector } from '@bytezhang/hardware-wallet-core';

export const createLedgerConnector = async (): Promise<IConnector> => {
  const { createLedgerWebHidConnector } =
    await import('@bytezhang/hardware-ledger-connector-webhid');
  return createLedgerWebHidConnector();
};
