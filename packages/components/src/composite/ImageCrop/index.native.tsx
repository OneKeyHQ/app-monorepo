import { openPicker as nativeOpenPicker } from 'react-native-image-crop-picker';
import { withStaticProperties } from 'tamagui';

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
  const response: IPickerImage = await nativeOpenPicker({
    mediaType: 'photo',
    cropping: true,
    forceJpg: true,
    includeBase64: true,
    sortOrder: 'desc',
    cropperChooseText: appLocale.intl.formatMessage({
      id: ETranslations.global_confirm,
    }),
    cropperCancelText: appLocale.intl.formatMessage({
      id: ETranslations.global_cancel,
    }),
    ...params,
  });
  if (response.data) {
    response.data = `${BASE64_PREFIX}${response.data}`;
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return response as any;
};

export const ImageCrop = withStaticProperties(BasicImageCrop, {
  openPicker,
});
