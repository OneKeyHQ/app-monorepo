import type { IConnector } from '@onekeyfe/hwk-adapter-core';

// Desktop (Electron): WebUSB works in renderer process for Trezor — the
// device exposes interface 0 over the same WebUSB API Chrome uses.
// Identical to the default web target; if a future Electron build needs
// to push USB into the main process (e.g. to share the handle with a
// non-renderer worker), this file is the swap point.
export const createTrezorConnector = async (): Promise<IConnector> => {
  const { createTrezorWebUsbConnector } = await import(
    '@onekeyfe/hwk-trezor-connector-webusb'
  );
  return createTrezorWebUsbConnector({
    thp: {
      hostName: 'OneKey',
      appName: 'OneKey Wallet',
    },
  });
};
