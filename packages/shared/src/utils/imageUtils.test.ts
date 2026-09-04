// otsuThreshold/toGrayScale/shouldInvertForMajorityWhite are pure functions,
// but the module's top-level imports pull in native-only packages this
// environment doesn't support.
import {
  deleteAsync as ExpoFSDeleteAsync,
  downloadAsync as ExpoFSDownloadAsync,
} from 'expo-file-system/legacy';

import platformEnv from '../platformEnv';

import imageUtils, {
  atkinsonDither,
  detectMimeTypeFromMagicBytes,
  getImageMimeTypeFromBase64Uri,
  otsuFromHistogram,
  pickThresholdAxis,
  probeImageMimeType,
  shouldInvertForMajorityWhite,
  toGrayScale,
} from './imageUtils';

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  deleteAsync: jest.fn(async () => undefined),
  downloadAsync: jest.fn(async (_uri: string, savedPath: string) => ({
    headers: { 'content-type': 'application/octet-stream' },
    uri: savedPath,
  })),
  getInfoAsync: jest.fn(async (uri: string) => ({ exists: true, uri })),
  makeDirectoryAsync: jest.fn(async () => undefined),
  readAsStringAsync: jest.fn(async () =>
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]).toString('base64'),
  ),
  writeAsStringAsync: jest.fn(async () => undefined),
}));
jest.mock('expo-image-manipulator', () => ({}));
jest.mock('stackblur-canvas', () => ({ canvasRGBA: () => {} }));
jest.mock('../platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: true,
    isNativeAndroid: false,
  },
}));

// Test-only structural fixture: the MIME parser reads chunk boundaries/types,
// while image decoding and CRC validation remain outside this unit's scope.
function createPngChunkFixtureBase64(chunkTypes: string[]) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const chunks = chunkTypes.map((type) => {
    let data = Buffer.alloc(0);
    if (type === 'IHDR') {
      data = Buffer.alloc(13);
      data.writeUInt32BE(1, 0);
      data.writeUInt32BE(1, 4);
      data[8] = 8;
      data[9] = 6;
    } else if (type === 'acTL') {
      data = Buffer.alloc(8);
      data.writeUInt32BE(1, 0);
    }
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    return Buffer.concat([
      length,
      Buffer.from(type, 'ascii'),
      data,
      Buffer.alloc(4),
    ]);
  });
  return Buffer.concat([signature, ...chunks]).toString('base64');
}

describe('detectMimeTypeFromMagicBytes', () => {
  it('distinguishes APNG from a static PNG by the acTL chunk', () => {
    expect(
      detectMimeTypeFromMagicBytes(
        createPngChunkFixtureBase64(['IHDR', 'acTL', 'IDAT', 'IEND']),
      ),
    ).toBe('image/apng');
    expect(
      detectMimeTypeFromMagicBytes(
        createPngChunkFixtureBase64(['IHDR', 'IDAT', 'IEND']),
      ),
    ).toBe('image/png');
  });

  it('does not accept an acTL chunk placed after image data', () => {
    expect(
      detectMimeTypeFromMagicBytes(
        createPngChunkFixtureBase64(['IHDR', 'IDAT', 'acTL', 'IEND']),
      ),
    ).toBe('image/png');
  });

  it('prefers JPEG file content independently of the response MIME type', () => {
    expect(
      detectMimeTypeFromMagicBytes(
        Buffer.from([0xff, 0xd8, 0xff, 0xe0]).toString('base64'),
      ),
    ).toBe('image/jpeg');
  });

  it('overrides a generic data URL MIME type with detected JPEG content', () => {
    const jpegBase64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0]).toString('base64');
    expect(
      getImageMimeTypeFromBase64Uri(
        `data:application/octet-stream;base64,${jpegBase64}`,
      ),
    ).toBe('image/jpeg');
  });
});

describe('probeImageMimeType', () => {
  const uri = 'https://example.com/nft-media';
  const originalFetch = globalThis.fetch;
  const fetchMock = jest.fn();

  beforeEach(() => {
    Object.assign(platformEnv, { isNative: false });
    globalThis.fetch = fetchMock as never;
  });

  afterEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = originalFetch;
    Object.assign(platformEnv, { isNative: true });
  });

  function mockStreamingResponse(bytes: Uint8Array, contentType: string) {
    const read = jest
      .fn()
      .mockResolvedValueOnce({ done: false, value: bytes })
      .mockResolvedValueOnce({ done: true, value: undefined });
    const cancel = jest.fn(async () => undefined);
    fetchMock.mockResolvedValueOnce({
      body: { getReader: () => ({ read, cancel }) },
      headers: new Headers({ 'content-type': contentType }),
    } as unknown as Response);
    return { read, cancel };
  }

  it('uses a bounded range request and content bytes instead of preloading media', async () => {
    const { cancel } = mockStreamingResponse(
      new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
      'application/octet-stream',
    );

    await expect(probeImageMimeType(uri)).resolves.toBe('image/jpeg');
    expect(fetchMock).toHaveBeenCalledWith(
      uri,
      expect.objectContaining({
        headers: { Range: 'bytes=0-65535' },
      }),
    );
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('detects APNG from the bounded PNG chunk prefix', async () => {
    mockStreamingResponse(
      Buffer.from(
        createPngChunkFixtureBase64(['IHDR', 'acTL', 'IDAT']),
        'base64',
      ),
      'image/png',
    );

    await expect(probeImageMimeType(uri)).resolves.toBe('image/apng');
  });

  it('does not assume a truncated PNG prefix is static', async () => {
    mockStreamingResponse(
      Buffer.from(createPngChunkFixtureBase64(['IHDR']), 'base64'),
      'image/png',
    );

    await expect(probeImageMimeType(uri)).resolves.toBeUndefined();
  });

  it('does not buffer an unbounded response when streaming is unavailable', async () => {
    const arrayBuffer = jest.fn();
    fetchMock.mockResolvedValueOnce({
      arrayBuffer,
      body: undefined,
      headers: new Headers({
        'content-type': 'video/mp4',
      }),
    } as unknown as Response);

    await expect(probeImageMimeType(uri)).resolves.toBeUndefined();
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it('uses a file-backed range probe on native', async () => {
    Object.assign(platformEnv, { isNative: true });
    const downloadAsyncMock = jest.mocked(ExpoFSDownloadAsync);
    downloadAsyncMock.mockClear();
    fetchMock.mockResolvedValueOnce({
      headers: new Headers({
        'accept-ranges': 'bytes',
        'content-type': 'application/octet-stream',
      }),
    } as unknown as Response);

    await expect(probeImageMimeType(uri)).resolves.toBe('image/jpeg');
    expect(fetchMock).toHaveBeenCalledWith(
      uri,
      expect.objectContaining({ method: 'HEAD' }),
    );
    expect(downloadAsyncMock).toHaveBeenCalledWith(
      uri,
      expect.stringContaining('temp-image-probe-'),
      { headers: { Range: 'bytes=0-65535' } },
    );
  });

  it('does not download unbounded native media without range support', async () => {
    Object.assign(platformEnv, { isNative: true });
    const downloadAsyncMock = jest.mocked(ExpoFSDownloadAsync);
    downloadAsyncMock.mockClear();
    fetchMock.mockResolvedValueOnce({
      headers: new Headers({
        'content-length': '1000000',
        'content-type': 'application/octet-stream',
      }),
    } as unknown as Response);

    await expect(probeImageMimeType(uri)).resolves.toBeUndefined();
    expect(downloadAsyncMock).not.toHaveBeenCalled();
  });
});

describe('prepareImageForCropWithInfo cleanup', () => {
  const deleteAsyncMock = jest.mocked(ExpoFSDeleteAsync);
  const downloadAsyncMock = jest.mocked(ExpoFSDownloadAsync);

  beforeEach(() => {
    deleteAsyncMock.mockClear();
    downloadAsyncMock.mockClear();
  });

  it('keeps a downloaded crop file until its owner releases it', async () => {
    const preparedImage = await imageUtils.prepareImageForCropWithInfo(
      'https://example.com/nft',
    );

    expect(preparedImage.mimeType).toBe('image/jpeg');
    expect(deleteAsyncMock).not.toHaveBeenCalled();

    await preparedImage.cleanup?.();
    await preparedImage.cleanup?.();

    expect(deleteAsyncMock).toHaveBeenCalledTimes(1);
    expect(deleteAsyncMock).toHaveBeenCalledWith(
      expect.stringContaining('temp-image-crop-'),
      { idempotent: true },
    );
  });

  it('removes a partial crop file when its download fails', async () => {
    downloadAsyncMock.mockRejectedValueOnce(new Error('download failed'));

    await expect(
      imageUtils.prepareImageForCropWithInfo('https://example.com/nft'),
    ).rejects.toThrow('Failed to process image source');
    expect(deleteAsyncMock).toHaveBeenCalledTimes(1);
  });
});

describe('toGrayScale', () => {
  it('weights green highest and blue lowest, matching ITU-R BT.601 luma', () => {
    expect(toGrayScale(255, 0, 0)).toBe(76);
    expect(toGrayScale(0, 255, 0)).toBe(150);
    expect(toGrayScale(0, 0, 255)).toBe(29);
    expect(toGrayScale(255, 255, 255)).toBe(255);
    expect(toGrayScale(0, 0, 0)).toBe(0);
  });
});

function histogramOf(values: number[]): { histogram: number[]; total: number } {
  const histogram = new Array<number>(256).fill(0);
  for (const v of values) histogram[v] += 1;
  return { histogram, total: values.length };
}

describe('otsuFromHistogram', () => {
  it('splits a clearly bimodal histogram between the two clusters', () => {
    const { histogram, total } = histogramOf([
      ...new Array<number>(100).fill(30),
      ...new Array<number>(100).fill(220),
    ]);
    const { threshold, separability } = otsuFromHistogram(histogram, total);
    expect(threshold).toBeGreaterThanOrEqual(30);
    expect(threshold).toBeLessThan(220);
    expect(separability).toBeCloseTo(1, 2);
  });

  it('scores a single smear of tones far below a real split', () => {
    const values: number[] = [];
    for (let i = 0; i < 1000; i += 1) values.push(126 + (i % 5));
    const { histogram, total } = histogramOf(values);
    expect(otsuFromHistogram(histogram, total).separability).toBeLessThan(0.85);
  });

  it('falls back to the default 128 when every value is identical', () => {
    const { histogram, total } = histogramOf(new Array<number>(100).fill(90));
    const result = otsuFromHistogram(histogram, total);
    expect(result.threshold).toBe(128);
    expect(result.separability).toBe(0);
  });

  it('does not throw on an empty histogram', () => {
    const { histogram, total } = histogramOf([]);
    expect(otsuFromHistogram(histogram, total).threshold).toBe(128);
  });
});

const WIDTH = 128;
const HEIGHT = 64;

type IRgb = [number, number, number];

function stripedImage(foreground: IRgb, background: IRgb): Uint8ClampedArray {
  const data = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const color = Math.floor(x / 8) % 2 === 0 ? foreground : background;
      const i = (y * WIDTH + x) * 4;
      [data[i], data[i + 1], data[i + 2], data[i + 3]] = [...color, 255];
    }
  }
  return data;
}

function nearSolidImage(color: IRgb, speckles: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  let seed = 42;
  const random = () => {
    seed = (seed * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return seed / 4_294_967_296;
  };
  for (let p = 0; p < WIDTH * HEIGHT; p += 1) {
    const i = p * 4;
    const noise = Math.round((random() * 2 - 1) * 6);
    [data[i], data[i + 1], data[i + 2], data[i + 3]] = [
      color[0] + noise,
      color[1] + noise,
      color[2] + noise,
      255,
    ];
  }
  for (let s = 0; s < speckles; s += 1) {
    const i = Math.floor(random() * WIDTH * HEIGHT) * 4;
    [data[i], data[i + 1], data[i + 2]] = [255, 255, 255];
  }
  return data;
}

const RED: IRgb = [255, 0, 0];
const GREEN: IRgb = [0, 255, 0];
const BLUE: IRgb = [0, 0, 255];
const YELLOW: IRgb = [255, 255, 0];
const MAGENTA: IRgb = [255, 0, 255];
const CYAN: IRgb = [0, 255, 255];
const WHITE: IRgb = [255, 255, 255];
const BLACK: IRgb = [0, 0, 0];

describe('pickThresholdAxis', () => {
  it('keeps the luminance axis whenever brightness already separates the image', () => {
    for (const [foreground, background] of [
      [RED, GREEN],
      [BLUE, WHITE],
      [MAGENTA, CYAN],
      [RED, BLACK],
    ] as Array<[IRgb, IRgb]>) {
      const result = pickThresholdAxis(stripedImage(foreground, background));
      expect(result.values).toBe(result.luminance);
      expect(result.canSplit).toBe(true);
    }
  });

  it('splits a two-tone pattern too narrow for the spread test to accept', () => {
    // Close tones must still be treated as clean clusters.
    const SALMON: IRgb = [255, 60, 90]; // luminance 122
    const STEEL_BLUE: IRgb = [100, 160, 200]; // luminance 147
    const OLIVE: IRgb = [150, 130, 40];
    const SLATE: IRgb = [90, 140, 190];
    const GREY_DARK: IRgb = [120, 120, 120];
    const GREY_LIGHT: IRgb = [140, 140, 140];
    for (const [foreground, background] of [
      [SALMON, STEEL_BLUE],
      [OLIVE, SLATE],
      [GREY_DARK, GREY_LIGHT],
      [BLUE, BLACK],
      [RED, MAGENTA],
      [GREEN, CYAN],
      [YELLOW, WHITE],
    ] as Array<[IRgb, IRgb]>) {
      const result = pickThresholdAxis(stripedImage(foreground, background));
      expect(result.canSplit).toBe(true);
    }
  });

  it('reaches for a color axis when two hues share the exact same luminance', () => {
    const RED_76: IRgb = [255, 0, 0];
    const GREEN_76: IRgb = [0, 129, 0];
    expect(toGrayScale(...RED_76)).toBe(toGrayScale(...GREEN_76));
    const result = pickThresholdAxis(stripedImage(RED_76, GREEN_76));
    expect(result.values).not.toBe(result.luminance);
    expect(result.canSplit).toBe(true);
  });

  it('reports a near-solid image as unsplittable, which now routes it to the dither', () => {
    expect(pickThresholdAxis(nearSolidImage([128, 128, 128], 1)).canSplit).toBe(
      false,
    );
    expect(pickThresholdAxis(nearSolidImage([90, 150, 220], 3)).canSplit).toBe(
      false,
    );
    expect(pickThresholdAxis(nearSolidImage([128, 128, 128], 0)).canSplit).toBe(
      false,
    );
  });
});

describe('atkinsonDither', () => {
  const WIDTH_8 = 8;

  it('never returns a blank field for a mid-tone image', () => {
    const flat = new Uint8ClampedArray(WIDTH_8 * WIDTH_8).fill(128);
    const out = atkinsonDither(flat, WIDTH_8);
    const white = out.filter((v) => v === 255).length;
    expect(white).toBeGreaterThan(0);
    expect(white).toBeLessThan(out.length);
  });

  it('tracks the tone: darker input yields fewer white pixels', () => {
    const ratio = (tone: number) => {
      const img = new Uint8ClampedArray(32 * 32).fill(tone);
      const out = atkinsonDither(img, 32);
      return out.filter((v) => v === 255).length / out.length;
    };
    expect(ratio(32)).toBeLessThan(ratio(128));
    expect(ratio(128)).toBeLessThan(ratio(224));
  });

  it('keeps pure black and pure white solid', () => {
    const black = atkinsonDither(new Uint8ClampedArray(64).fill(0), WIDTH_8);
    const white = atkinsonDither(new Uint8ClampedArray(64).fill(255), WIDTH_8);
    expect(black.every((v) => v === 0)).toBe(true);
    expect(white.every((v) => v === 255)).toBe(true);
  });

  it('emits exactly one value per input pixel', () => {
    const img = new Uint8ClampedArray(WIDTH_8 * 3).fill(100);
    expect(atkinsonDither(img, WIDTH_8)).toHaveLength(WIDTH_8 * 3);
  });
});

describe('polarity reported by pickThresholdAxis', () => {
  it('leaves the luminance axis pointing the way it already runs', () => {
    const result = pickThresholdAxis(stripedImage(WHITE, BLACK));
    expect(result.aboveIsBrighter).toBe(true);
  });

  it('flips for a color axis running opposite to brightness', () => {
    // Red separates the stripes while luminance overlaps.
    const data = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
    for (let p = 0; p < WIDTH * HEIGHT; p += 1) {
      const noise = (p % 5) - 2;
      const highRed = Math.floor((p % WIDTH) / 8) % 2 === 0;
      const color: IRgb = highRed ? [200, 67 + noise, 0] : [0, 172 + noise, 0];
      const i = p * 4;
      [data[i], data[i + 1], data[i + 2], data[i + 3]] = [...color, 255];
    }

    const result = pickThresholdAxis(data);
    expect(result.canSplit).toBe(true);
    expect(result.values).not.toBe(result.luminance);
    expect(result.aboveIsBrighter).toBe(false);
  });
});

describe('shouldInvertForMajorityWhite', () => {
  it('does not invert when white is a clear minority (skewed cartoon art)', () => {
    // A handful of bright accent-color pixels can pull the image's overall
    // look brighter even though most pixels land on the black side of the
    // Otsu threshold. White stays a clear ~39% minority, so this must not invert.
    expect(shouldInvertForMajorityWhite(386, 1000)).toBe(false);
  });

  it('does not invert when the ratio sits inside the dead zone around 50%', () => {
    expect(shouldInvertForMajorityWhite(510, 1000)).toBe(false);
    expect(shouldInvertForMajorityWhite(490, 1000)).toBe(false);
  });

  it('inverts once white is unambiguously past the dead zone', () => {
    expect(shouldInvertForMajorityWhite(560, 1000)).toBe(true);
    expect(shouldInvertForMajorityWhite(950, 1000)).toBe(true);
  });

  it('never inverts a fully black image and always inverts a fully white one', () => {
    expect(shouldInvertForMajorityWhite(0, 1000)).toBe(false);
    expect(shouldInvertForMajorityWhite(1000, 1000)).toBe(true);
  });

  it('keeps the (50%, 55%] band un-inverted, unlike the old plain >50% rule', () => {
    // The pre-fix code inverted as soon as post-threshold white passed 50%.
    // This dead zone is the actual behavior change: values here now stay
    // un-inverted where they used to flip.
    expect(shouldInvertForMajorityWhite(501, 1000)).toBe(false);
    expect(shouldInvertForMajorityWhite(550, 1000)).toBe(false);
    expect(shouldInvertForMajorityWhite(551, 1000)).toBe(true);
  });
});
