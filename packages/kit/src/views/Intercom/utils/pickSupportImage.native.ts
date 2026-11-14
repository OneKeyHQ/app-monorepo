import ImageCropPicker, {
  ImageCropPickerError,
} from '@onekeyfe/react-native-image-crop-picker';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IIntercomImage } from '@onekeyhq/shared/src/modules3rdParty/intercom/messengerTypes';

export async function pickSupportImage(): Promise<IIntercomImage | undefined> {
  try {
    // Both native processors encode decoded pixels to a fresh JPEG, without
    // copying the original EXIF/GPS metadata (including HEIC source metadata).
    const image = await ImageCropPicker.openPicker({
      preserveOriginal: false,
      compressImageQuality: 0.9,
      compressImageMaxWidth: 4096,
      compressImageMaxHeight: 4096,
    });
    if (image.size > 20 * 1024 * 1024) {
      await ImageCropPicker.cleanSingle(image.path);
      throw new OneKeyLocalError('Support image must be smaller than 20 MB');
    }
    return {
      ...image,
      filename: `${image.filename?.replace(/\.[^.]*$/, '') || 'support-image'}.jpg`,
    };
  } catch (error) {
    if (
      error instanceof ImageCropPickerError &&
      error.code === 'E_PICKER_CANCELLED'
    )
      return undefined;
    throw error;
  }
}
export const cleanSupportImage = (path: string) =>
  ImageCropPicker.cleanSingle(path);
