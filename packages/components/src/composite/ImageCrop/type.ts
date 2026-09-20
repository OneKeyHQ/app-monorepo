import type { Image, Options } from '@onekeyfe/react-native-image-crop-picker';

export interface IPickerImageOptions extends Options {
  /**
   * Width of the result image. Also sets the crop aspect ratio.
   */
  width: number;

  /**
   * Height of the result image. Also sets the crop aspect ratio.
   */
  height: number;
}

export type IOpenPickerFunc = (
  options: IPickerImageOptions,
) => Promise<IPickerImage>;

export type IPickerImage = Image;

export const RESULT_MINE_TYPE = 'image/jpeg';

// The native module rejects with this code when the user backs out of the
// system photo picker or the cropper. That is a normal outcome, so callers
// must swallow it instead of letting it escape as an unhandled rejection.
export const IMAGE_PICKER_CANCELLED_CODE = 'E_PICKER_CANCELLED';

// The web picker and cropper are our own dialogs, so they have to raise the
// cancel themselves. Carrying the native module's code keeps one predicate
// valid on every platform — callers must never match on the message text.
export class ImagePickerCancelledError extends Error {
  readonly code = IMAGE_PICKER_CANCELLED_CODE;

  constructor() {
    super('User cancelled image selection');
    this.name = 'ImagePickerCancelledError';
  }
}

export function isImagePickerCancelledError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === IMAGE_PICKER_CANCELLED_CODE
  );
}
