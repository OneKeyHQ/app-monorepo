import type { CoreApi } from '@onekeyfe/hd-core';

export const importHardwareSDK = async () =>
  (await import('@onekeyfe/hd-web-sdk')).default as unknown as CoreApi;
