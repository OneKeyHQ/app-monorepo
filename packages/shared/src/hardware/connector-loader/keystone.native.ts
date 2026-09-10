import { OneKeyLocalError } from '../../errors';

import type { IConnector } from '@onekeyfe/hwk-adapter-core';

// iOS and Android currently support Keystone through the air-gapped QR flow.
// Keeping WebUSB out of the native background bundle also prevents every QR
// signing request from probing a browser-only transport before falling back.
export const createKeystoneUsbConnector = async (): Promise<IConnector> => {
  throw new OneKeyLocalError(
    'Keystone USB transport is not available on native',
  );
};
