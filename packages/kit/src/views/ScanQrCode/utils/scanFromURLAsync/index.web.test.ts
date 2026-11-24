import { decodeQrImage } from '@onekeyfe/react-native-qr-scanner/web';

import { dataUrlToBlob, scanFromURLAsync } from './index.web';

const mockEnsureConfigured = jest.fn<void, []>();

jest.mock('@onekeyfe/react-native-qr-scanner/web', () => ({
  DEFAULT_MAX_IMAGE_PIXELS: 16_777_216,
  decodeQrImage: jest.fn(),
}));
jest.mock('../../components/ScanCamera/webQrScanner', () => ({
  ensureWebQrScannerConfigured: () => mockEnsureConfigured(),
}));

async function blobBytes(blob: Blob) {
  return new Uint8Array(await new Response(blob).arrayBuffer());
}

describe('dataUrlToBlob', () => {
  it('decodes base64 data URLs from the photo picker', async () => {
    const blob = dataUrlToBlob('data:image/png;base64,AAEC/w==');
    expect(blob.type).toBe('image/png');
    expect(Array.from(await blobBytes(blob))).toEqual([0, 1, 2, 255]);
  });

  it('decodes percent-encoded data URLs', async () => {
    const blob = dataUrlToBlob('data:image/svg+xml,%3Csvg%2F%3E');
    expect(blob.type).toBe('image/svg+xml');
    expect(await new Response(blob).text()).toBe('<svg/>');
  });

  it('rejects other URLs', () => {
    expect(() => dataUrlToBlob('https://example.com/qr.png')).toThrow();
  });
});

describe('scanFromURLAsync', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.mocked(decodeQrImage).mockReset();
  });

  it('configures the SDK and decodes the picked image', async () => {
    jest.mocked(decodeQrImage).mockResolvedValueOnce('lightning:lnbc1');

    await expect(
      scanFromURLAsync('data:image/png;base64,AAEC/w=='),
    ).resolves.toBe('lightning:lnbc1');
    expect(mockEnsureConfigured).toHaveBeenCalled();
    const [blob] = jest.mocked(decodeQrImage).mock.calls[0];
    expect(Array.from(await blobBytes(blob))).toEqual([0, 1, 2, 255]);
  });

  it.each([
    ['dark modules', 'qr', ['#fff']],
    ['light modules', null, ['#fff', '#000']],
  ])(
    'decodes transparent SVGs with %s',
    async (_name, firstResult, expected) => {
      const backgrounds: string[] = [];
      const context = {
        fillStyle: '',
        fillRect: jest.fn((): void => {
          backgrounds.push(context.fillStyle);
        }),
        drawImage: jest.fn(),
      };
      const png = new Blob([], { type: 'image/png' });
      const canvas = {
        width: 0,
        height: 0,
        getContext: () => context,
        toBlob: (callback: (blob: Blob) => void) => callback(png),
      };
      class TestImage {
        naturalWidth = 32;

        naturalHeight = 32;

        decode = jest.fn(async () => {});
      }
      Object.assign(globalThis, {
        Image: TestImage,
        document: { createElement: () => canvas },
      });
      try {
        jest
          .mocked(decodeQrImage)
          .mockResolvedValueOnce(firstResult)
          .mockResolvedValueOnce('qr');
        await expect(
          scanFromURLAsync('data:image/svg+xml,%3Csvg%2F%3E'),
        ).resolves.toBe('qr');
        expect(backgrounds).toEqual(expected);
        expect(context.fillRect).toHaveBeenCalledWith(0, 0, 32, 32);
        expect(context.fillRect.mock.invocationCallOrder[0]).toBeLessThan(
          context.drawImage.mock.invocationCallOrder[0],
        );
        expect(decodeQrImage).toHaveBeenCalledWith(png);
        expect(decodeQrImage).toHaveBeenCalledTimes(expected.length);
      } finally {
        Reflect.deleteProperty(globalThis, 'Image');
        Reflect.deleteProperty(globalThis, 'document');
      }
    },
  );

  it('resolves null when the image cannot be decoded', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.mocked(decodeQrImage).mockRejectedValueOnce(new Error('invalid'));

    await expect(scanFromURLAsync('not-a-data-url')).resolves.toBeNull();
    await expect(
      scanFromURLAsync('data:image/png;base64,AAEC/w=='),
    ).resolves.toBeNull();
  });
});
