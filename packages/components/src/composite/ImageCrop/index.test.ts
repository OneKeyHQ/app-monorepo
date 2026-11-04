import { ImageCrop } from '.';

import {
  cleanSingle,
  openCropper,
  openPicker,
} from '@onekeyfe/react-native-image-crop-picker';

let mockIsNative = false;

jest.mock('@onekeyfe/react-native-image-crop-picker', () => ({
  openPicker: jest.fn(),
  openCropper: jest.fn(),
  cleanSingle: jest.fn(async () => {}),
}));
jest.mock('@onekeyhq/components/src/shared/tamagui', () => ({
  withStaticProperties: Object.assign,
}));
jest.mock('@onekeyhq/shared/src/errors', () => ({
  OneKeyLocalError: Error,
}));
jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: {
    global_crop_image: 'crop',
    global_confirm: 'confirm',
    global_cancel: 'cancel',
  },
}));
jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: { intl: { formatMessage: ({ id }: { id: string }) => id } },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNative() {
      return mockIsNative;
    },
  },
}));
jest.mock('../../hocs/Provider/fonts/brandFont', () => ({
  BRAND_FONT_NATIVE_FAMILY: { semibold: 'Test', medium: 'Test' },
  BRAND_FONT_WEB_FAMILY: 'Test',
}));
jest.mock('../../hocs/Provider/hooks/useAppearanceTheme', () => ({
  getAppThemeVariant: () => undefined,
}));
jest.mock('../../utils/scale', () => ({ uiScale: 1 }));

beforeEach(() => {
  jest.clearAllMocks();
  mockIsNative = false;
});

describe.each([
  {
    name: 'picker',
    open: () => ImageCrop.openPicker({ width: 100, height: 100 }),
    module: openPicker,
  },
  {
    name: 'cropper',
    open: () => ImageCrop.openCropImage('source.png', 100, 100),
    module: openCropper,
  },
])('$name result ownership', ({ open, module: openModule }) => {
  it.each([false, true])(
    'releases only browser Blob paths with native=%s',
    async (isNative) => {
      mockIsNative = isNative;
      const path = isNative ? 'file:///image.jpg' : 'blob:result';
      jest.mocked(openModule).mockResolvedValueOnce({
        path,
        data: 'jpeg-base64',
        mime: 'image/jpeg',
        width: 100,
        height: 100,
        size: 10,
      });

      const result = await open();

      expect(result.data).toBe('data:image/jpeg;base64,jpeg-base64');
      if (isNative) {
        expect(result.path).toBe(path);
        expect(cleanSingle).not.toHaveBeenCalled();
      } else {
        expect(cleanSingle).toHaveBeenCalledWith(path);
        expect(result.path).toBe('');
      }
    },
  );
});

it('keeps a browser path when the caller requests no base64 result', async () => {
  jest.mocked(openPicker).mockResolvedValueOnce({
    path: 'blob:path-only',
    mime: 'image/jpeg',
    width: 100,
    height: 100,
    size: 10,
  });

  const result = await ImageCrop.openPicker({
    width: 100,
    height: 100,
    includeBase64: false,
  });

  expect(result.path).toBe('blob:path-only');
  expect(cleanSingle).not.toHaveBeenCalled();
});
