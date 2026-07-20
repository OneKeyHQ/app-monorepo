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
        },
      }),
    ).resolves.toMatchObject({
      screenHex: 'resized-jpeg-hex',
      blurScreenHex: 'blur-hex',
    });
    expect(mockedImageUtils.resizeImage).toHaveBeenCalledWith(
      expect.objectContaining({
        width: 604,
        height: 1024,
        originW: 0,
        originH: 0,
      }),
    );
  });
});
