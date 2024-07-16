import { openPicker as nativeOpenPicker } from 'react-native-image-crop-picker';
import { withStaticProperties } from 'tamagui';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

import type { IOpenPickerFunc } from './type';

function BasicImageCrop() {
  return null;
}

const openPicker: IOpenPickerFunc = (params: any) =>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  nativeOpenPicker({
    cropping: true,
    cropperChooseText: appLocale.intl.formatMessage({
      id: ETranslations.global_confirm,
    }),
    cropperCancelText: appLocale.intl.formatMessage({
      id: ETranslations.global_cancel,
    }),
    ...params,
  }) as any;

export const ImageCrop = withStaticProperties(BasicImageCrop, {
  openPicker,
});
