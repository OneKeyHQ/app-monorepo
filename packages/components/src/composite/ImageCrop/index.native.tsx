/* eslint-disable onekey/no-app-locale-main-thread -- low-level cropper utility consumed via callbacks */
import {
  openCropper as nativeOpenCropper,
  openPicker as nativeOpenPicker,
} from 'react-native-image-crop-picker';

import { withStaticProperties } from '@onekeyhq/components/src/shared/tamagui';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

import {
  type IOpenPickerFunc,
  type IPickerImage,
  RESULT_MINE_TYPE,
} from './type';

function BasicImageCrop() {
  return null;
}

const BASE64_PREFIX = `data:${RESULT_MINE_TYPE};base64,`;

const openPicker: IOpenPickerFunc = async (params) => {
  const response = await nativeOpenPicker({
    cropping: true,
    includeBase64: true,
    // eslint-disable-next-line onekey/no-app-locale-main-thread
    cropperChooseText: appLocale.intl.formatMessage({
      id: ETranslations.global_confirm,
    }),
    // eslint-disable-next-line onekey/no-app-locale-main-thread
    cropperCancelText: appLocale.intl.formatMessage({
      id: ETranslations.global_cancel,
    }),
    ...params,
  });
  if (response.data) {
    response.data = `${BASE64_PREFIX}${response.data}`;
  }
  return response;
};

const openCropImage = async (
  image: string,
  width: number,
  height: number,
): Promise<IPickerImage> => {
  if (!image) {
    throw new OneKeyLocalError('image.nativeUri is empty:');
  }

  const response = await nativeOpenCropper({
    path: image,
    width,
    height,
    includeBase64: true,
    // eslint-disable-next-line onekey/no-app-locale-main-thread
    cropperChooseText: appLocale.intl.formatMessage({
      id: ETranslations.global_confirm,
    }),
    // eslint-disable-next-line onekey/no-app-locale-main-thread
    cropperCancelText: appLocale.intl.formatMessage({
      id: ETranslations.global_cancel,
    }),
  });

  if (response.data) {
    response.data = `${BASE64_PREFIX}${response.data}`;
  }

  return response;
};

export const ImageCrop = withStaticProperties(BasicImageCrop, {
  openPicker,
  openCropImage,
});
