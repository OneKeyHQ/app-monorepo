import { getTrezorThpIdentity } from '../trezorThpIdentity';

import type { IConnector } from '@onekeyfe/hwk-adapter-core';

// Default (web): browser tab with WebUSB. THP host identity matches the
// current platform without exposing a real machine name.
export const createTrezorConnector = async (): Promise<IConnector> => {
  const { createTrezorWebUsbConnector } =
    await import('@onekeyfe/hwk-trezor-connector-webusb');
  const thpIdentity = getTrezorThpIdentity();
  return createTrezorWebUsbConnector({
    thp: {
      hostName: thpIdentity.hostName,
      appName: thpIdentity.appName,
    },
  });
};
