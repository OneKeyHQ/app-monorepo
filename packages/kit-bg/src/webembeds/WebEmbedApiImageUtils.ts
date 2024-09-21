import deviceHomeScreenUtils from '@onekeyhq/shared/src/utils/deviceHomeScreenUtils';
import imageUtils from '@onekeyhq/shared/src/utils/imageUtils';

import type { IDeviceType } from '@onekeyfe/hd-core';

class WebEmbedApiImageUtils {
  async base64ImageToBitmap(params: {
    base64: string;
    width: number;
    height: number;
  }): Promise<string> {
    return imageUtils.base64ImageToBitmap(params);
  }

  convertToBlackAndWhiteImageBase64(
    colorImageBase64: string,
    mime: string,
  ): Promise<string> {
    return imageUtils.convertToBlackAndWhiteImageBase64(colorImageBase64, mime);
  }
}

export default WebEmbedApiImageUtils;
