import type {
  CommonOptions,
  Image,
  PossibleArray,
} from 'react-native-image-crop-picker';

export interface IPickerImageOptions extends CommonOptions {
  /**
   * Width of result image when used with `cropping` option.
   */
  width: number;

  /**
   * Height of result image when used with `cropping` option.
   */
  height: number;

  /**
   * When set to true, the image file content will be available as a base64-encoded string in
   * the data property. Hint: To use this string as an image source, use it like:
   * <Image source={{uri: `data:${image.mime};base64,${image.data}`}} />
   *
   * @default false
   */
  includeBase64?: boolean;

  /**
   * Include image exif data in the response.
   *
   * @default false
   */
  includeExif?: boolean;

  /**
   * Whether to convert photos to JPG. This will also convert any Live Photo into its JPG representation.
   *
   * @default false
   */
  forceJpg?: boolean;

  /**
   * Enable or disable cropping.
   *
   * @default false
   */
  cropping?: boolean;

  /**
   * When set to true, the image will always fill the mask space.
   *
   * @default true
   */
  avoidEmptySpaceAroundImage?: boolean;

  /**
   * When cropping image, determines ActiveWidget color.
   *
   * @platform Android only
   * @default '#424242'
   */
  cropperActiveWidgetColor?: string;

  /**
   * When cropping image, determines the color of StatusBar.
   *
   * @platform Android only
   * @default '#424242'
   */
  cropperStatusBarColor?: string;

  /**
   * When cropping image, determines the color of Toolbar.
   *
   * @platform Android only
   * @default '#424242'
   */
  cropperToolbarColor?: string;

  /**
   * When cropping image, determines the color of Toolbar text and buttons.
   *
   * @platform Android only
   * @default 'darker orange'
   */
  cropperToolbarWidgetColor?: string;

  /**
   * When cropping image, determines the title of Toolbar.
   *
   * @default 'Edit Photo'
   */
  cropperToolbarTitle?: string;

  /**
   * Enables user to apply custom rectangle area for cropping.
   *
   * @platform iOS only
   * @default false
   */
  freeStyleCropEnabled?: boolean;

  /**
   * cropperTintColor
   */
  cropperTintColor?: string;

  /**
   * Enable or disable circular cropping mask.
   *
   * @default false
   */
  cropperCircleOverlay?: boolean;

  /**
   * Cancel button text.
   *
   * @default 'Cancel'
   */
  cropperCancelText?: string;

  /**
   * Cancel button color. HEX-like string color.
   *
   * @example '#ff00ee'
   * @platform iOS only
   */
  cropperCancelColor?: string;

  /**
   * Choose button text.
   *
   * @default 'Choose'
   */
  cropperChooseText?: string;

  /**
   * Choose button color. HEX-like string color.
   *
   * @example '#EE00DD'
   * @platform iOS only
   */
  cropperChooseColor?: string;

  /**
   * Enable or disable cropper rotate buttons.
   *
   * @platform iOS only
   * @default false
   */
  cropperRotateButtonsHidden?: boolean;

  /**
   * Whether to show the 3x3 grid on top of the image during cropping.
   *
   * @platform Android only
   * @default true
   */
  showCropGuidelines?: boolean;

  /**
   * Whether to show the square crop frame during cropping
   *
   * @platform Android only
   * @default true
   */
  showCropFrame?: boolean;

  /**
   * Whether to enable rotating the image by hand gesture.
   *
   * @platform Android only
   * @default false
   */
  enableRotationGesture?: boolean;

  /**
   * When cropping image, disables the color setters for cropping library.
   *
   * @platform Android only
   * @default false
   */
  disableCropperColorSetters?: boolean;

  /**
   * Compress image with maximum width.
   *
   * @default null
   */
  compressImageMaxWidth?: number;

  /**
   * Compress image with maximum height.
   *
   * @default null
   */
  compressImageMaxHeight?: number;

  /**
   * Compress image with quality (from 0 to 1, where 1 is best quality). On iOS, values larger
   * than 0.8 don't produce a noticeable quality increase in most images, while a value of 0.8
   * will reduce the file size by about half or less compared to a value of 1.
   *
   * @default Android: 1, iOS: 0.8
   */
  compressImageQuality?: number;
}

export type IOpenPickerFunc = <T extends IPickerImageOptions>(
  options: T,
) => Promise<PossibleArray<T, Image>>;

export type IPickerImage = Image;

export const RESULT_MINE_TYPE = 'image/jpeg';
