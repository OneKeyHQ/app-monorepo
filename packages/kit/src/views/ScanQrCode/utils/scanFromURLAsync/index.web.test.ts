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

function avifUrl(
  width: number,
  height: number,
  extraSizes: [number, number][] = [],
) {
  const textBytes = (text: string) =>
    Array.from(text, (char) => char.charCodeAt(0));
  const box = (kind: string, body: number[]) => {
    const size = new DataView(new ArrayBuffer(4));
    size.setUint32(0, body.length + 8);
    return [...new Uint8Array(size.buffer), ...textBytes(kind), ...body];
  };
  const sizes = [[width, height], ...extraSizes].flatMap(([w, h]) => {
    const extent = new DataView(new ArrayBuffer(12));
    extent.setUint32(4, w);
    extent.setUint32(8, h);
    return box('ispe', [...new Uint8Array(extent.buffer)]);
  });
  const ftyp = box('ftyp', [...textBytes('avif'), 0, 0, 0, 0]);
  const meta = box('meta', [0, 0, 0, 0, ...box('iprp', box('ipco', sizes))]);
  return `data:image/avif;base64,${btoa(String.fromCharCode(...ftyp, ...meta))}`;
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
    [
      'SVG with dark modules',
      'data:image/svg+xml,%3Csvg%2F%3E',
      'qr',
      ['#fff'],
    ],
    [
      'SVG with light modules',
      'data:image/svg+xml,%3Csvg%2F%3E',
      null,
      ['#fff', '#000'],
    ],
    ['AVIF via the browser renderer', avifUrl(32, 32), 'qr', ['#fff']],
  ])('decodes %s', async (_name, dataUrl, firstResult, expected) => {
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
      await expect(scanFromURLAsync(dataUrl)).resolves.toBe('qr');
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
  });

  it.each([avifUrl(8192, 8192), avifUrl(32, 32, [[8192, 8192]])])(
    'rejects an over-budget AVIF before creating a browser image',
    async (dataUrl) => {
      const imageConstructor = jest.fn();
      Object.assign(globalThis, { Image: imageConstructor });
      try {
        await expect(scanFromURLAsync(dataUrl)).resolves.toBeNull();
        expect(imageConstructor).not.toHaveBeenCalled();
        expect(decodeQrImage).not.toHaveBeenCalled();
      } finally {
        Reflect.deleteProperty(globalThis, 'Image');
      }
    },
  );

  it('rejects an oversized AVIF payload before decoding Base64', async () => {
    const decode = jest.spyOn(globalThis, 'atob');
    try {
      const encodedLimit = Math.ceil((16 * 1024 * 1024) / 3) * 4;
      const dataUrl = `data:image/avif;base64,${'A'.repeat(encodedLimit)}`;
      await expect(scanFromURLAsync(dataUrl)).resolves.toBeNull();
      expect(decode).not.toHaveBeenCalled();
    } finally {
      jest.restoreAllMocks();
    }
  });

  it('resolves null when the image cannot be decoded', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.mocked(decodeQrImage).mockRejectedValueOnce(new Error('invalid'));

    await expect(scanFromURLAsync('not-a-data-url')).resolves.toBeNull();
    await expect(
      scanFromURLAsync('data:image/png;base64,AAEC/w=='),
    ).resolves.toBeNull();
  });
});
