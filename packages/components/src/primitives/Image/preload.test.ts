import { preloadImages } from './preload';
import { preloadImages as preloadNativeImages } from './preload.native';

jest.mock('@onekeyfe/react-native-image', () => ({
  OneKeyImageCache: {
    preload: jest.fn(),
  },
  OneKeyImageCachePolicy: {
    DISK: 'disk',
    MEMORY: 'memory',
    MEMORY_DISK: 'memory-disk',
    NONE: 'none',
  },
}));

jest.mock('react-native', () => ({
  Image: {
    prefetch: jest.fn(),
  },
  PixelRatio: {
    get: () => 1,
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isWeb: true,
    isWebEmbed: false,
  },
}));

const mockPrefetch = (
  jest.requireMock('react-native') as {
    Image: {
      prefetch: jest.Mock<Promise<boolean>, [string]>;
    };
  }
).Image.prefetch;
const mockNativePreload = (
  jest.requireMock('@onekeyfe/react-native-image') as {
    OneKeyImageCache: {
      preload: jest.Mock;
    };
  }
).OneKeyImageCache.preload;

describe('preloadImages', () => {
  beforeEach(() => {
    mockPrefetch.mockReset();
  });

  test('treats a resolved React Native Web prefetch as success', async () => {
    mockPrefetch.mockResolvedValue(undefined as never);

    await expect(
      preloadImages([{ optimize: false, uri: 'https://example.com/a.png' }]),
    ).resolves.toBe(true);
  });

  test('returns false when prefetch resolves with a failed result', async () => {
    mockPrefetch.mockResolvedValue(false);

    await expect(
      preloadImages([{ optimize: false, uri: 'https://example.com/a.png' }]),
    ).resolves.toBe(false);
  });

  test('returns false instead of rejecting when a prefetch fails', async () => {
    mockPrefetch
      .mockResolvedValueOnce(undefined as never)
      .mockRejectedValueOnce(new Error('not found'));

    await expect(
      preloadImages([
        { optimize: false, uri: 'https://example.com/a.png' },
        { optimize: false, uri: 'https://example.com/b.png' },
      ]),
    ).resolves.toBe(false);
  });

  test('does not prefetch sources with custom request headers', async () => {
    mockPrefetch.mockResolvedValue(undefined as never);

    await expect(
      preloadImages([
        {
          optimize: false,
          uri: 'https://example.com/private.png',
          headers: { Authorization: 'Bearer token' },
        },
        {
          optimize: false,
          uri: 'https://example.com/public.png',
        },
      ]),
    ).resolves.toBe(false);

    expect(mockPrefetch).toHaveBeenCalledTimes(1);
    expect(mockPrefetch).toHaveBeenCalledWith('https://example.com/public.png');
  });
});

describe('native preloadImages', () => {
  beforeEach(() => {
    mockNativePreload.mockReset();
    mockNativePreload.mockResolvedValue(true);
  });

  test('passes the raw URL and layout size to native rendition selection', async () => {
    await preloadNativeImages([
      { uri: 'https://uni.onekey-asset.com/token.png', resizeWidth: 32 },
    ]);
    expect(mockNativePreload).toHaveBeenCalledWith([
      expect.objectContaining({
        uri: 'https://uni.onekey-asset.com/token.png',
        resizeWidth: 32,
        pixelRatio: undefined,
        optimizeTos: true,
      }),
    ]);
  });

  test('forwards explicit density, dimensions, and optimization opt-outs', async () => {
    await preloadNativeImages(
      [
        {
          uri: 'https://uni.onekey-asset.com/a.png',
          width: 32,
          height: 64,
          pixelRatio: 2.625,
        },
        {
          uri: 'https://uni.onekey-asset.com/b.png',
          resizeWidth: 40,
          optimize: false,
        },
        {
          uri: 'https://uni.onekey-asset.com/private.png',
          resizeWidth: 32,
          headers: { Authorization: 'test' },
        },
      ],
      { pixelRatio: 3 },
    );
    expect(mockNativePreload).toHaveBeenNthCalledWith(1, [
      expect.objectContaining({
        resizeWidth: 32,
        resizeHeight: 64,
        pixelRatio: 2.625,
        optimizeTos: true,
      }),
    ]);
    expect(mockNativePreload).toHaveBeenNthCalledWith(2, [
      expect.objectContaining({ pixelRatio: 3, optimizeTos: false }),
    ]);
    expect(mockNativePreload).toHaveBeenNthCalledWith(3, [
      expect.objectContaining({
        headers: { Authorization: 'test' },
        optimizeTos: false,
      }),
    ]);
  });

  test('reports native failure without repeating its optimized-to-raw fallback in JS', async () => {
    mockNativePreload.mockResolvedValueOnce(false);
    await expect(
      preloadNativeImages([
        { uri: 'https://uni.onekey-asset.com/token.png', resizeWidth: 32 },
      ]),
    ).resolves.toBe(false);
    expect(mockNativePreload).toHaveBeenCalledTimes(1);
  });

  test('returns false for blank sources while preloading valid entries', async () => {
    await expect(
      preloadNativeImages([
        { uri: 'https://example.com/a.png', optimize: false },
        { uri: '   ', optimize: false },
      ]),
    ).resolves.toBe(false);

    expect(mockNativePreload).toHaveBeenCalledTimes(1);
    expect(mockNativePreload).toHaveBeenCalledWith([
      expect.objectContaining({ uri: 'https://example.com/a.png' }),
    ]);
  });
});
