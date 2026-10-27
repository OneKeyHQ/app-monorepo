import ImageCropPicker, {
  ImageCropPickerError,
} from '@onekeyfe/react-native-image-crop-picker';
import NativePhotoLibrary from '@onekeyfe/react-native-photo-library';

import type { IPickedPhoto } from './type';

async function pickImage(): Promise<IPickedPhoto> {
  try {
    const image = await ImageCropPicker.openPicker({ preserveOriginal: true });
    return { canceled: false, uri: image.path };
  } catch (error) {
    if (
      error instanceof ImageCropPickerError &&
      error.code === 'E_PICKER_CANCELLED'
    ) {
      return { canceled: true };
    }
    throw error;
  }
}

const photoLibrary = {
  pickImage,
  releasePickedImage: ImageCropPicker.cleanSingle,
  getSavePermission: NativePhotoLibrary.getSavePermission,
  requestSavePermission: NativePhotoLibrary.requestSavePermission,
  saveToLibrary: NativePhotoLibrary.saveToLibrary,
};

export default photoLibrary;
