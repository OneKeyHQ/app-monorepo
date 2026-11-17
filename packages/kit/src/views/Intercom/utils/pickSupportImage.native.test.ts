import ImageCropPicker, {
  ImageCropPickerError,
} from '@onekeyfe/react-native-image-crop-picker';

import { cleanSupportImage, pickSupportImage } from './pickSupportImage.native';

jest.mock('@onekeyhq/shared/src/errors', () => ({ OneKeyLocalError: Error }));
jest.mock('@onekeyfe/react-native-image-crop-picker', () => ({
  __esModule: true,
  default: { openPicker: jest.fn(), cleanSingle: jest.fn(async () => {}) },
  ImageCropPickerError: class extends Error {
    constructor(
      readonly code: string,
      message: string,
    ) {
      super(message);
    }
  },
}));

const image = {
  path: 'file:///temporary/encoded.jpg',
  filename: 'photo.heic',
  mime: 'image/jpeg',
  size: 100,
  width: 10,
  height: 10,
};
beforeEach(() => jest.clearAllMocks());

it('uses the native pixel re-encoder and aligns a HEIC filename with the JPEG output', async () => {
  jest.mocked(ImageCropPicker.openPicker).mockResolvedValueOnce(image);
  const result = await pickSupportImage();
  expect(ImageCropPicker.openPicker).toHaveBeenCalledWith({
    preserveOriginal: false,
    compressImageQuality: 0.9,
    compressImageMaxWidth: 4096,
    compressImageMaxHeight: 4096,
  });
  expect(result).toEqual({ ...image, filename: 'photo.jpg' });
  await cleanSupportImage(image.path);
  expect(ImageCropPicker.cleanSingle).toHaveBeenCalledWith(image.path);
});

it('removes an oversized encoded file before reporting an error', async () => {
  jest
    .mocked(ImageCropPicker.openPicker)
    .mockResolvedValueOnce({ ...image, size: 20 * 1024 * 1024 + 1 });
  await expect(pickSupportImage()).rejects.toThrow('smaller than 20 MB');
  expect(ImageCropPicker.cleanSingle).toHaveBeenCalledWith(image.path);
});

it('resolves cancellation but reports processing failures', async () => {
  jest
    .mocked(ImageCropPicker.openPicker)
    .mockRejectedValueOnce(
      new ImageCropPickerError('E_PICKER_CANCELLED', 'canceled'),
    );
  await expect(pickSupportImage()).resolves.toBeUndefined();
  jest
    .mocked(ImageCropPicker.openPicker)
    .mockRejectedValueOnce(
      new ImageCropPickerError('E_CANNOT_SAVE_IMAGE', 'failed'),
    );
  await expect(pickSupportImage()).rejects.toThrow('failed');
});
