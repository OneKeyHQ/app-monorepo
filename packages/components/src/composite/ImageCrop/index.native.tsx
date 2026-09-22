import {
  openCropper as nativeOpenCropper,
  openPicker as nativeOpenPicker,
} from '@onekeyfe/react-native-image-crop-picker';

import {
  getTokenValue,
  withStaticProperties,
} from '@onekeyhq/components/src/shared/tamagui';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

import { getAppThemeVariant } from '../../hocs/Provider/hooks/useAppearanceTheme';
import { uiScale } from '../../utils/scale';

import {
  type IOpenPickerFunc,
  type IPickerImage,
  RESULT_MINE_TYPE,
} from './type';

import type {
  ImageCropPickerOptions,
  ImageCropperAppearance,
} from '@onekeyfe/react-native-image-crop-picker';

function BasicImageCrop() {
  return null;
}

// A fixed JPEG prefix is always correct: the native module decodes every
// picked or cropped image, HEIC and PNG included, and re-encodes it as JPEG
// on both platforms, so `data` is JPEG and `mime` is always image/jpeg.
// That is also why `forceJpg` is no longer passed.
const BASE64_PREFIX = `data:${RESULT_MINE_TYPE};base64,`;

// The page background, header and footer Button tokens, so the native
// cropper looks like an app page in either theme.
const CROPPER_COLOR_TOKENS = {
  light: {
    backgroundColor: '$bgAppLight',
    titleColor: '$textLight',
    iconColor: '$iconLight',
    cancelButtonColor: '$bgStrongLight',
    cancelButtonPressedColor: '$bgStrongActiveLight',
    cancelButtonTextColor: '$textLight',
    confirmButtonColor: '$bgPrimaryLight',
    confirmButtonPressedColor: '$bgPrimaryActiveLight',
    confirmButtonTextColor: '$textInverseLight',
  },
  dark: {
    backgroundColor: '$bgAppDark',
    titleColor: '$textDark',
    iconColor: '$iconDark',
    cancelButtonColor: '$bgStrongDark',
    cancelButtonPressedColor: '$bgStrongActiveDark',
    cancelButtonTextColor: '$textDark',
    confirmButtonColor: '$bgPrimaryDark',
    confirmButtonPressedColor: '$bgPrimaryActiveDark',
    confirmButtonTextColor: '$textInverseDark',
  },
} as const;

function getCropperAppearance(): ImageCropperAppearance {
  const appearance: ImageCropperAppearance = {
    // $headingLg and $bodyLgMedium.
    titleFontFamily: 'Roobert-SemiBold',
    buttonFontFamily: 'Roobert-Medium',
    scale: uiScale,
  };
  const variant = getAppThemeVariant();
  if (!variant) {
    // The cropper falls back to the system appearance.
    return appearance;
  }
  const tokens = CROPPER_COLOR_TOKENS[variant];
  const color = (token: (typeof tokens)[keyof typeof tokens]) =>
    getTokenValue(token, 'color') as string;
  return {
    ...appearance,
    colorScheme: variant,
    backgroundColor: color(tokens.backgroundColor),
    titleColor: color(tokens.titleColor),
    iconColor: color(tokens.iconColor),
    cancelButtonColor: color(tokens.cancelButtonColor),
    cancelButtonPressedColor: color(tokens.cancelButtonPressedColor),
    cancelButtonTextColor: color(tokens.cancelButtonTextColor),
    confirmButtonColor: color(tokens.confirmButtonColor),
    confirmButtonPressedColor: color(tokens.confirmButtonPressedColor),
    confirmButtonTextColor: color(tokens.confirmButtonTextColor),
  };
}

function getCropperOptions(): ImageCropPickerOptions {
  return {
    // eslint-disable-next-line onekey/no-app-locale-main-thread
    cropperToolbarTitle: appLocale.intl.formatMessage({
      id: ETranslations.global_crop_image,
    }),
    // eslint-disable-next-line onekey/no-app-locale-main-thread
    cropperChooseText: appLocale.intl.formatMessage({
      id: ETranslations.global_confirm,
    }),
    // eslint-disable-next-line onekey/no-app-locale-main-thread
    cropperCancelText: appLocale.intl.formatMessage({
      id: ETranslations.global_cancel,
    }),
    cropperAppearance: getCropperAppearance(),
  };
}

const openPicker: IOpenPickerFunc = async (params) => {
  const response = await nativeOpenPicker({
    cropping: true,
    includeBase64: true,
    ...getCropperOptions(),
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
    ...getCropperOptions(),
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
