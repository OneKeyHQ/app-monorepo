import type { IConnector } from '@onekeyfe/hwk-adapter-core';

// SW bundle only (webpack: ext + bg + MV3). SW has no navigator.usb, so
// tunnel every IConnector call to offscreen via the bridge — mirrors
// ledger.ext-bg-v3.ts. THP-specific extras (THP credential replay,
// ui-request forwarding) ride the same bridge as the standard IConnector
// methods; see OffscreenApiThirdPartyHardware for the offscreen-side
// vendor switch.
export const createTrezorConnector = async (): Promise<IConnector> => {
  const [{ createBridgedConnector }, { getOffscreenHardwareBridgeClient }] =
    await Promise.all([
      import('@onekeyfe/hwk-adapter-core'),
      import(
        '@onekeyhq/kit-bg/src/services/ServiceHardware/adapters/offscreenHardwareBridgeClient'
      ),
    ]);
  return createBridgedConnector(
    'trezor',
    'usb',
    getOffscreenHardwareBridgeClient(),
  );
};
