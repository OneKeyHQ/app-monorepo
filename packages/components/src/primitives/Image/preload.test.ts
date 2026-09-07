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

  test('uses the same encoded TOS URL as the render path', async () => {
    await preloadNativeImages([
      {
        uri: 'https://uni.onekey-asset.com/token.png',
        resizeWidth: 32,
        pixelRatio: 1,
      },
    ]);

    expect(mockNativePreload).toHaveBeenCalledWith([
      expect.objectContaining({
        uri: 'https://uni.onekey-asset.com/token.png?x-tos-process=image%2Fresize%2Cw_40',
        optimizeTos: false,
      }),
    ]);
  });

  test('retries the original URLs when an optimized preload fails', async () => {
    mockNativePreload.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await expect(
      preloadNativeImages([
        {
          uri: 'https://uni.onekey-asset.com/token.png',
          resizeWidth: 32,
          pixelRatio: 1,
        },
      ]),
    ).resolves.toBe(true);

    expect(mockNativePreload).toHaveBeenNthCalledWith(2, [
      expect.objectContaining({
        uri: 'https://uni.onekey-asset.com/token.png',
        optimizeTos: false,
      }),
    ]);
  });

  test('only retries failed optimized entries with their original URLs', async () => {
    mockNativePreload
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    await expect(
      preloadNativeImages([
        {
          uri: 'https://uni.onekey-asset.com/a.png',
          resizeWidth: 32,
          pixelRatio: 1,
        },
        {
          uri: 'https://uni.onekey-asset.com/b.png',
          resizeWidth: 32,
          pixelRatio: 1,
        },
        {
          uri: 'https://example.com/c.png',
          optimize: false,
        },
      ]),
    ).resolves.toBe(true);

    expect(mockNativePreload).toHaveBeenCalledTimes(4);
    expect(mockNativePreload).toHaveBeenNthCalledWith(3, [
      expect.objectContaining({ uri: 'https://example.com/c.png' }),
    ]);
    expect(mockNativePreload).toHaveBeenNthCalledWith(4, [
      expect.objectContaining({
        uri: 'https://uni.onekey-asset.com/b.png',
      }),
    ]);
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
