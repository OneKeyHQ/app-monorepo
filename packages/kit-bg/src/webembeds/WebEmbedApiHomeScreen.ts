import deviceHomeScreenUtils from '@onekeyhq/shared/src/utils/deviceHomeScreenUtils';
import imageUtils from '@onekeyhq/shared/src/utils/imageUtils';

import type { IDeviceType } from '@onekeyfe/hd-core';

class WebEmbedApiHomeScreen {
  async imagePathToHex(base64OrUri: string, deviceModelInternal: IDeviceType) {
    return deviceHomeScreenUtils.imagePathToHex(
      base64OrUri,
      deviceModelInternal,
    );
  }

  convertToBlackAndWhiteImageBase64(
    colorImageBase64: string,
    mime: string,
  ): Promise<string> {
    return imageUtils.convertToBlackAndWhiteImageBase64(colorImageBase64, mime);
  }
}

export default WebEmbedApiHomeScreen;
