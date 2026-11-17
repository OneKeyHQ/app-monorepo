// cspell:ignore zxing
import { decodeQrImageData } from './index.web';

const mockPrepareZXingReader = jest.fn(async () => undefined);
const mockPonyfillDetect = jest.fn();
const mockPonyfillBarcodeDetector = jest.fn((_options: unknown) => ({
  detect: mockPonyfillDetect,
}));

jest.mock('../../components/ScanCamera/zxingReader', () => ({
  prepareZXingReader: () => mockPrepareZXingReader(),
}));

jest.mock('barcode-detector/ponyfill', () => ({
  BarcodeDetector: function BarcodeDetector(options: unknown) {
    return mockPonyfillBarcodeDetector(options);
  },
}));

describe('decodeQrImageData', () => {
  const imageData = { data: new Uint8ClampedArray(4), height: 1, width: 1 };

  afterEach(() => {
    jest.clearAllMocks();
    delete (globalThis as { BarcodeDetector?: unknown }).BarcodeDetector;
  });

  it('uses the native BarcodeDetector without loading zxing', async () => {
    const nativeDetect = jest.fn(async () => [{ rawValue: 'native-value' }]);
    (globalThis as { BarcodeDetector?: unknown }).BarcodeDetector = jest.fn(
      () => ({ detect: nativeDetect }),
    );

    await expect(
      decodeQrImageData(imageData as unknown as ImageData),
    ).resolves.toBe('native-value');
    expect(nativeDetect).toHaveBeenCalledWith(imageData);
    expect(mockPrepareZXingReader).not.toHaveBeenCalled();
    expect(mockPonyfillBarcodeDetector).not.toHaveBeenCalled();
  });

  it('prepares the bundled zxing reader before using the polyfill', async () => {
    mockPonyfillDetect.mockResolvedValue([{ rawValue: 'zxing-value' }]);

    await expect(
      decodeQrImageData(imageData as unknown as ImageData),
    ).resolves.toBe('zxing-value');
    expect(mockPonyfillBarcodeDetector).toHaveBeenCalledWith({
      formats: ['qr_code'],
    });
    expect(mockPrepareZXingReader.mock.invocationCallOrder[0]).toBeLessThan(
      mockPonyfillBarcodeDetector.mock.invocationCallOrder[0],
    );
  });

  it('returns null when the image has no QR code', async () => {
    mockPonyfillDetect.mockResolvedValue([]);

    await expect(
      decodeQrImageData(imageData as unknown as ImageData),
    ).resolves.toBeNull();
  });
});
