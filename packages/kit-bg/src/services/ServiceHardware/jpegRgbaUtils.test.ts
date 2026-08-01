import { decodeJpegToRgba } from './jpegRgbaUtils';

jest.mock('jpeg-js', () => ({
  decode: jest.fn(),
}));

const mockDecode = jest.requireMock('jpeg-js').decode as jest.Mock;

describe('decodeJpegToRgba', () => {
  beforeEach(() => {
    mockDecode.mockReset();
    mockDecode.mockReturnValue({
      width: 2,
      height: 1,
      data: new Uint8Array(8),
    });
  });

  it('returns validated RGBA pixels for any JPEG resource', () => {
    expect(
      decodeJpegToRgba({
        imageHex: 'ffd8ff',
        expectedWidth: 2,
        expectedHeight: 1,
        label: 'NFT image',
      }),
    ).toMatchObject({ width: 2, height: 1, data: expect.any(Uint8Array) });
  });

  it('rejects empty image data', () => {
    expect(() =>
      decodeJpegToRgba({
        imageHex: '',
        expectedWidth: 2,
        expectedHeight: 1,
        label: 'wallpaper',
      }),
    ).toThrow('image is empty');
  });

  it('rejects an unexpected image size', () => {
    expect(() =>
      decodeJpegToRgba({
        imageHex: 'ffd8ff',
        expectedWidth: 1,
        expectedHeight: 1,
        label: 'NFT image',
      }),
    ).toThrow('expected 1x1');
  });

  it('rejects an invalid RGBA buffer length', () => {
    mockDecode.mockReturnValue({
      width: 2,
      height: 1,
      data: new Uint8Array(4),
    });

    expect(() =>
      decodeJpegToRgba({
        imageHex: 'ffd8ff',
        expectedWidth: 2,
        expectedHeight: 1,
        label: 'wallpaper',
      }),
    ).toThrow('RGBA length');
  });
});
