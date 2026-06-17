import type { IConnector } from '@onekeyfe/hwk-adapter-core';

// Default (web): browser tab with WebUSB. THP host identity matches the
// offscreen build so credentials minted in one environment can be replayed
// in the other (same hostName + appName).
export const createTrezorConnector = async (): Promise<IConnector> => {
  const { createTrezorWebUsbConnector } =
    await import('@onekeyfe/hwk-trezor-connector-webusb');
  return createTrezorWebUsbConnector({
    thp: {
      hostName: 'OneKey',
      appName: 'OneKey Wallet',
    },
  });
};
