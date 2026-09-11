import type { ElectronBleApi, IConnector } from '@onekeyfe/hwk-adapter-core';

type ILedgerDesktopHost = {
  window?: { desktopApi?: { thirdPartyBle?: ElectronBleApi } };
};

export const createLedgerConnector = async (): Promise<IConnector> => {
  const { createLedgerWebHidConnector } =
    await import('@onekeyfe/hwk-ledger-connector-webhid');
  const usb = createLedgerWebHidConnector();
  const bridge = (globalThis as ILedgerDesktopHost).window?.desktopApi
    ?.thirdPartyBle;
  if (!bridge) return usb;
  const [{ createLedgerElectronBleConnector }, { createCombinedConnector }] =
    await Promise.all([
      import('@onekeyfe/hwk-ledger-connector-electron-ble'),
      import('@onekeyfe/hwk-adapter-core'),
    ]);
  return createCombinedConnector([
    usb,
    createLedgerElectronBleConnector(bridge),
  ]);
};
