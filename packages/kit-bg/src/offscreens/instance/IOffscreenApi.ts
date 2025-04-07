import type OffscreenApiAdaSdk from '../OffscreenApiAdaSdk';
import type OffscreenApiKaspaSdk from '../OffscreenApiKaspaSdk';
import type { LowLevelCoreApi } from '@onekeyfe/hd-core';

export interface IOffscreenApi {
  hardwareSDKLowLevel: LowLevelCoreApi;
  adaSdk: OffscreenApiAdaSdk;
  kaspaSdk: OffscreenApiKaspaSdk;
}
