import type { IConnector } from '@onekeyfe/hwk-adapter-core';

// Desktop (Electron): Ledger uses WebHID which works in Electron's renderer process.
// Unlike Trezor (which needs Node USB transport in main process), Ledger DMK
// can run directly in the renderer via the same WebHID connector as web.
export const createLedgerConnector = async (): Promise<IConnector> => {
  const { createLedgerWebHidConnector } =
    await import('@onekeyfe/hwk-ledger-connector-webhid');
  return createLedgerWebHidConnector();
};
