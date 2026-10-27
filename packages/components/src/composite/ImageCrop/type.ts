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
