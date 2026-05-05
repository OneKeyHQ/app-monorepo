import type { IConnector } from '@onekeyfe/hwk-adapter-core';

// SW bundle only (webpack: ext + bg + MV3). SW has no navigator.hid,
// so tunnel every IConnector call to offscreen via the bridge — mirrors
// sdk-loader/index.ext-bg-v3.ts; the kit-bg import is scoped to this suffix.
export const createLedgerConnector = async (): Promise<IConnector> => {
  const [{ createBridgedConnector }, { getOffscreenHardwareBridgeClient }] =
    await Promise.all([
      import('@onekeyfe/hwk-adapter-core'),
      import('@onekeyhq/kit-bg/src/services/ServiceHardware/adapters/offscreenHardwareBridgeClient'),
    ]);
  return createBridgedConnector(
    'ledger',
    'usb',
    getOffscreenHardwareBridgeClient(),
  );
};
