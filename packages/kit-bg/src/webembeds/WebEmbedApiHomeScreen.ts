import deviceHomeScreenUtils from '@onekeyhq/shared/src/utils/deviceHomeScreenUtils';

import type { IDeviceType } from '@onekeyfe/hd-core';

class WebEmbedApiHomeScreen {
  async imagePathToHex(base64OrUri: string, deviceModelInternal: IDeviceType) {
    return deviceHomeScreenUtils.imagePathToHex(
      base64OrUri,
      deviceModelInternal,
    );
  }
}

export default WebEmbedApiHomeScreen;
