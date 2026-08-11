import { EDeviceType } from '@onekeyfe/hd-shared';

import deviceHomeScreenUtils from './deviceHomeScreenUtils';
import imageUtils from './imageUtils';

jest.mock('./imageUtils', () => ({
  __esModule: true,
  default: {
    getBase64FromRequiredImageSource: jest.fn(),
    prefixBase64Uri: jest.fn((value: string) => value),
    processImageBlur: jest.fn(),
    resizeImage: jest.fn(),
    stripBase64UriPrefix: jest.fn((value: string) =>
      value.replace(/^data:image\/\w+;base64,/, ''),
    ),
  },
}));

const mockedImageUtils = jest.mocked(imageUtils);

describe('deviceHomeScreenUtils.buildCustomScreenHex', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resizes a Pro 2 JPEG to the device wallpaper dimensions', async () => {
    mockedImageUtils.getBase64FromRequiredImageSource.mockResolvedValue(
      'data:image/jpeg;base64,AAAA',
    );
    mockedImageUtils.resizeImage.mockResolvedValue({
      hex: 'resized-jpeg-hex',
      uri: 'resized-jpeg-uri',
      width: 604,
      height: 1024,
      base64: 'resized-jpeg-base64',
    });
    mockedImageUtils.processImageBlur.mockResolvedValue({
      hex: 'blur-hex',
      width: 604,
      height: 1024,
    });

    await expect(
      deviceHomeScreenUtils.buildCustomScreenHex({
        dbDeviceId: 'pro2-device',
        url: 'https://example.com/pro-wallpaper.jpg',
        deviceType: EDeviceType.Pro2,
        config: {
          names: [],
          size: { width: 604, height: 1024 },
          thumbnailSize: { width: 263, height: 263 },
        },
      }),
    ).resolves.toMatchObject({
      screenHex: '',
      screenBase64: 'resized-jpeg-base64',
      blurScreenHex: 'blur-hex',
    });
    expect(mockedImageUtils.resizeImage).toHaveBeenCalledWith(
      expect.objectContaining({
        width: 604,
        height: 1024,
        originW: 0,
        originH: 0,
        includeHex: false,
      }),
    );
    expect(mockedImageUtils.resizeImage).toHaveBeenCalledTimes(1);
  });

  it('fails when a Protocol V2 wallpaper resize has no JPEG data', async () => {
    mockedImageUtils.getBase64FromRequiredImageSource.mockResolvedValue(
      'data:image/jpeg;base64,AAAA',
    );
    mockedImageUtils.resizeImage.mockResolvedValue({
      hex: '',
      uri: '',
      width: 0,
      height: 0,
    });

    await expect(
      deviceHomeScreenUtils.buildCustomScreenHex({
        dbDeviceId: 'pro2-device',
        url: 'https://example.com/pro-wallpaper.jpg',
        deviceType: EDeviceType.Pro2,
        config: {
          names: [],
          size: { width: 604, height: 1024 },
          thumbnailSize: { width: 263, height: 263 },
        },
      }),
    ).rejects.toThrow('Pro2 wallpaper JPEG data is missing');
    expect(mockedImageUtils.processImageBlur).not.toHaveBeenCalled();
  });

  it('does not return Base64 for a legacy color-screen device', async () => {
    mockedImageUtils.getBase64FromRequiredImageSource.mockResolvedValue(
      'data:image/jpeg;base64,QUJD',
    );
    mockedImageUtils.resizeImage.mockResolvedValue({
      hex: 'thumbnail-hex',
      uri: 'thumbnail-uri',
      width: 200,
      height: 200,
    });
    mockedImageUtils.processImageBlur.mockResolvedValue({
      hex: 'blur-hex',
      width: 480,
      height: 800,
    });

    await expect(
      deviceHomeScreenUtils.buildCustomScreenHex({
        dbDeviceId: 'pro-device',
        url: 'https://example.com/pro-wallpaper.jpg',
        deviceType: EDeviceType.Pro,
        isUserUpload: true,
        config: {
          names: [],
          size: { width: 480, height: 800 },
          thumbnailSize: { width: 200, height: 200 },
        },
      }),
    ).resolves.toMatchObject({
      screenHex: '414243',
      screenBase64: undefined,
      thumbnailHex: 'thumbnail-hex',
      blurScreenHex: 'blur-hex',
    });
  });
});
