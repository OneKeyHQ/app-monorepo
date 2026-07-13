import type { IConnector } from '@onekeyfe/hwk-adapter-core';

export const createLedgerConnector = async (): Promise<IConnector> => {
  const { createLedgerWebHidConnector } =
    await import('@onekeyfe/hwk-ledger-connector-webhid');
  return createLedgerWebHidConnector();
};
