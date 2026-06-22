import { OneKeyLocalError } from '../../errors';

import type { IConnector, IHardwareBridge } from '@onekeyfe/hwk-adapter-core';

// SW bundle only (webpack: ext + bg + MV3). SW has no navigator.usb, so
// tunnel every IConnector call to offscreen via the bridge — mirrors
// ledger.ext-bg-v3.ts. THP-specific extras (THP credential replay,
// ui-request forwarding) ride the same bridge as the standard IConnector
// methods; see OffscreenApiThirdPartyHardware for the offscreen-side
// vendor switch.
export const createTrezorConnector = async (options?: {
  bridge?: IHardwareBridge;
}): Promise<IConnector> => {
  if (!options?.bridge) {
    throw new OneKeyLocalError(
      'createTrezorConnector(ext): bridge is required',
    );
  }
  const { createBridgedConnector } = await import('@onekeyfe/hwk-adapter-core');
  return createBridgedConnector('trezor', 'usb', options.bridge);
};
