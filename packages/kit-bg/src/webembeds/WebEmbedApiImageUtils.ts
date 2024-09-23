import imageUtils from '@onekeyhq/shared/src/utils/imageUtils';

class WebEmbedApiImageUtils {
  async base64ImageToBitmap(params: {
    base64: string;
    width: number;
    height: number;
  }): Promise<string> {
    return imageUtils.base64ImageToBitmap(params);
  }

  async convertToBlackAndWhiteImageBase64(
    colorImageBase64: string,
    mime: string,
  ): Promise<string> {
    return imageUtils.convertToBlackAndWhiteImageBase64(colorImageBase64, mime);
  }
}

export default WebEmbedApiImageUtils;
