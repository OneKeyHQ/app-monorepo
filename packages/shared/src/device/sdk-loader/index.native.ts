import type { CoreApi } from '@onekeyfe/hd-core';

export const importHardwareSDK = async () =>
  import('@onekeyfe/hd-ble-sdk') as unknown as Promise<CoreApi>;
