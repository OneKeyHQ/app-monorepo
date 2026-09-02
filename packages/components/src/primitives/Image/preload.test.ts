import { preloadImages } from './preload';

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

jest.mock('@onekeyhq/shared/src/utils/tosImageResizeUtils', () => ({
  buildTosImageResizeUrl: ({ uri }: { uri: string }) => ({ uri }),
}));

const mockPrefetch = (
  jest.requireMock('react-native') as {
    Image: {
      prefetch: jest.Mock<Promise<boolean>, [string]>;
    };
  }
).Image.prefetch;

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
});
