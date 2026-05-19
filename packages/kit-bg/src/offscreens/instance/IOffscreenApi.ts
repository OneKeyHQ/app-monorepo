import type OffscreenApiAdaSdk from '../OffscreenApiAdaSdk';
import type OffscreenApiKaspaSdk from '../OffscreenApiKaspaSdk';
import type OffscreenApiThirdPartyHardware from '../OffscreenApiThirdPartyHardware';
import type { LowLevelCoreApi } from '@onekeyfe/hd-core';

export interface IOffscreenApi {
  hardwareSDKLowLevel: LowLevelCoreApi;
  adaSdk: OffscreenApiAdaSdk;
  kaspaSdk: OffscreenApiKaspaSdk;
  thirdPartyHardware: OffscreenApiThirdPartyHardware;
}
