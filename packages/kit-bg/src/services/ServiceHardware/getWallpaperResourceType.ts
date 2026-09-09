import type { DeviceUploadResourceParams } from '@onekeyfe/hd-core';

export function getWallpaperResourceType(): DeviceUploadResourceParams['resType'] {
  // ResourceType.WallPaper is the stable Protocol V1/V2 wire value. Web must
  // not load the hardware SDK only to read this protocol constant.
  return 0;
}
