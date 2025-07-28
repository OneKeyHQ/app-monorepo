import { isString } from 'lodash';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

import type { IDeviceType } from '@onekeyfe/hd-core';

export class HardwareHomeScreenScene extends BaseScene {
  @LogToLocal()
  public setHomeScreen(params: {
    deviceId: string;
    deviceType: IDeviceType;
    deviceName: string;
    imgName: string;
    imgResType: string;
    imgHex: string;
    thumbnailHex: string;
    blurScreenHex: string;
    buildCustomHexError: string | undefined;
    isUserUpload: boolean | undefined;
  }) {
    const {
      deviceId,
      deviceType,
      deviceName,
      imgName,
      imgResType,
      imgHex,
      thumbnailHex,
      blurScreenHex,
      buildCustomHexError,
      isUserUpload,
    } = params;
    return {
      deviceId,
      deviceType,
      deviceName,
      imgName,
      buildCustomHexError,
      isUserUpload,
      imgHex: imgHex?.slice(0, 10),
      thumbnailHex: thumbnailHex?.slice(0, 10),
      blurScreenHex: blurScreenHex?.slice(0, 10),
      imgResType,
    };
  }

  @LogToLocal()
  public getBase64FromRequiredImageSource(...args: string[]) {
    const output = ([] as string[]).concat(args);
    return output.filter(isString);
  }
}
