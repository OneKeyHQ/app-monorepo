import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  getColdStartImageUrisFromSnapshot,
  getStockColdStartImageUrisFromSnapshot,
  prewarmColdStartImagesFromSnapshot,
  prewarmImageUris,
} from './coldStartImagePreload';

const mockPrimeCachedImagePaths = jest.fn<Promise<void>, [unknown]>(
  async () => undefined,
);
const mockPrimeCachedImageRefs = jest.fn<Promise<void>, [unknown]>(
  async () => undefined,
);
const mockGetMissingCachedImageRefUris = jest.fn((uris: string[]) => uris);
const mockPreloadImages = jest.fn<Promise<void>, [unknown]>(
  async () => undefined,
);
const mockGetColdStartObject = jest.fn<unknown, [string]>();

jest.mock('@onekeyhq/components', () => ({
  getMissingCachedImageRefUris: (uris: string[]) =>
    mockGetMissingCachedImageRefUris(uris),
  preloadImages: (sources: unknown) => mockPreloadImages(sources),
  primeCachedImagePaths: (params: unknown) => mockPrimeCachedImagePaths(params),
  primeCachedImageRefs: (params: unknown) => mockPrimeCachedImageRefs(params),
}));

jest.mock('@onekeyhq/shared/src/storage/instance/syncStorageInstance', () => ({
  coldStartCacheStorage: {
    getObject: (key: string) => mockGetColdStartObject(key),
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNativeAndroid: false,
    isNativeIOS: false,
  },
}));

const mockPlatformEnv = platformEnv as unknown as {
  isNativeAndroid: boolean;
  isNativeIOS: boolean;
};

describe('getColdStartImageUrisFromSnapshot', () => {
  beforeEach(() => {
    mockPrimeCachedImagePaths.mockReset().mockResolvedValue(undefined);
    mockPrimeCachedImageRefs.mockReset().mockResolvedValue(undefined);
    mockGetMissingCachedImageRefUris
      .mockReset()
      .mockImplementation((uris: string[]) => uris);
    mockPreloadImages.mockReset().mockResolvedValue(undefined);
    mockGetColdStartObject.mockReset();
    mockPlatformEnv.isNativeAndroid = false;
    mockPlatformEnv.isNativeIOS = false;
  });

  it('prewarms only the main Swap account Stock pair before live atoms hydrate', () => {
    const snapshot = {
      'store:swap::ctx:swapSelectedTokensColdStartContextAtom': {
        accountKey: 'account-1',
        swapType: 'swap',
      },
      'store:swap@modal::ctx:swapSelectedTokensColdStartContextAtom': {
        accountKey: 'modal-account',
        swapType: 'stock',
      },
    };
    const stockDisplayStore = {
      version: 1,
      entries: Object.fromEntries([
        ...Array.from({ length: 8 }, (_, index) => [
          encodeURIComponent(`stale-account-${index}`),
          {
            updatedAt: 100 + index,
            snapshot: {
              identity: { accountKey: `stale-account-${index}` },
              selection: {
                identity: { accountKey: `stale-account-${index}` },
                stockToken: {
                  logoURI: `https://example.com/stale-${index}.png`,
                },
              },
            },
          },
        ]),
        [
          encodeURIComponent('modal-account'),
          {
            updatedAt: 999,
            snapshot: {
              identity: { accountKey: 'modal-account' },
              selection: {
                identity: { accountKey: 'modal-account' },
                stockToken: {
                  logoURI: 'https://example.com/modal.png',
                },
              },
            },
          },
        ],
        [
          encodeURIComponent('account-1'),
          {
            updatedAt: 1,
            snapshot: {
              identity: { accountKey: 'account-1' },
              selection: {
                identity: { accountKey: 'account-1' },
                stockToken: {
                  networkId: 'evm--56',
                  logoURI: 'https://example.com/stock.png',
                  networkLogoURI: 'https://example.com/network.png',
                },
                payToken: {
                  networkId: 'evm--56',
                  logoURI: 'https://example.com/pay.png',
                },
              },
              tokenDetail: {
                data: {
                  logoUrls: ['https://example.com/non-critical-detail.png'],
                },
              },
            },
          },
        ],
      ]),
    };

    const uris = getStockColdStartImageUrisFromSnapshot(
      snapshot,
      stockDisplayStore,
    );

    expect(uris).toEqual(
      expect.arrayContaining([
        'https://example.com/stock.png',
        'https://example.com/network.png',
        'https://example.com/pay.png',
      ]),
    );
    expect(uris).not.toContain('https://example.com/modal.png');
    expect(uris).not.toContain('https://example.com/non-critical-detail.png');
    for (let index = 0; index < 8; index += 1) {
      expect(uris).not.toContain(`https://example.com/stale-${index}.png`);
    }
  });

  it('limits a blocking Stock prewarm to the active tab and a fresh selection', () => {
    const now = 1_800_000_000_000;
    const buildSnapshot = ({
      contextSwapType = 'stock',
      visibleSwapType = 'stock',
    }: {
      contextSwapType?: string;
      visibleSwapType?: string;
    } = {}) => ({
      'store:swap::ctx:swapSelectedTokensColdStartContextAtom': {
        accountKey: 'account-1',
        swapType: contextSwapType,
      },
      'store:swap::ctx:swapTypeSwitchAtom': visibleSwapType,
    });
    const buildStore = (selectionUpdatedAt: number) => ({
      version: 1,
      entries: {
        [encodeURIComponent('account-1')]: {
          snapshot: {
            identity: { accountKey: 'account-1' },
            selection: {
              identity: { accountKey: 'account-1' },
              stockToken: {
                logoURI: 'https://example.com/critical-stock.png',
              },
              updatedAt: selectionUpdatedAt,
            },
          },
        },
      },
    });
    const blockingOptions = {
      maxSelectionAgeMs: 1000,
      now,
      requireActiveStock: true,
    };

    expect(
      getStockColdStartImageUrisFromSnapshot(
        buildSnapshot(),
        buildStore(now - 1000),
        blockingOptions,
      ),
    ).toEqual(['https://example.com/critical-stock.png']);
    expect(
      getStockColdStartImageUrisFromSnapshot(
        buildSnapshot({ contextSwapType: 'swap' }),
        buildStore(now),
        blockingOptions,
      ),
    ).toEqual([]);
    expect(
      getStockColdStartImageUrisFromSnapshot(
        buildSnapshot({ visibleSwapType: 'swap' }),
        buildStore(now),
        blockingOptions,
      ),
    ).toEqual([]);
    expect(
      getStockColdStartImageUrisFromSnapshot(
        buildSnapshot(),
        buildStore(now - 1001),
        blockingOptions,
      ),
    ).toEqual([]);
    expect(
      getStockColdStartImageUrisFromSnapshot(
        buildSnapshot(),
        buildStore(now + 1),
        blockingOptions,
      ),
    ).toEqual([]);
  });

  it('reads Stock storage only for an enabled critical path and at most once', async () => {
    const snapshot = {
      'store:swap::ctx:swapSelectedTokensColdStartContextAtom': {
        accountKey: 'account-1',
        swapType: 'swap',
      },
      'store:swap::ctx:swapTypeSwitchAtom': 'swap',
    };
    mockGetColdStartObject.mockReturnValue(undefined);

    await prewarmColdStartImagesFromSnapshot({
      snapshot,
      stockCriticalOptions: {
        awaitPreload: true,
        requireActiveStock: true,
      },
    });
    expect(mockGetColdStartObject).not.toHaveBeenCalled();

    await prewarmColdStartImagesFromSnapshot({ snapshot });
    expect(mockGetColdStartObject).not.toHaveBeenCalled();

    await prewarmColdStartImagesFromSnapshot({
      snapshot,
      stockCriticalOptions: { preload: false },
    });
    await prewarmColdStartImagesFromSnapshot({
      snapshot,
      stockCriticalOptions: { preload: false },
    });
    expect(mockGetColdStartObject).toHaveBeenCalledTimes(1);
  });

  it('rejects a dedicated Stock entry whose account identity is stale', () => {
    const uris = getStockColdStartImageUrisFromSnapshot(
      {
        'store:swap::ctx:swapSelectedTokensColdStartContextAtom': {
          accountKey: 'account-1',
          swapType: 'stock',
        },
      },
      {
        version: 1,
        entries: {
          [encodeURIComponent('account-1')]: {
            updatedAt: 30,
            snapshot: {
              identity: { accountKey: 'account-2' },
              selection: {
                identity: { accountKey: 'account-2' },
                stockToken: {
                  logoURI: 'https://example.com/stale-stock.png',
                },
              },
            },
          },
        },
      },
    );

    expect(uris).not.toContain('https://example.com/stale-stock.png');
  });

  it('does not let a Stock modal context become the main account', () => {
    const uris = getStockColdStartImageUrisFromSnapshot(
      {
        'store:swap@modal::ctx:swapSelectedTokensColdStartContextAtom': {
          accountKey: 'modal-account',
          swapType: 'stock',
        },
      },
      {
        version: 1,
        entries: {
          [encodeURIComponent('modal-account')]: {
            updatedAt: 30,
            snapshot: {
              identity: { accountKey: 'modal-account' },
              selection: {
                identity: { accountKey: 'modal-account' },
                stockToken: {
                  logoURI: 'https://example.com/modal-stock.png',
                },
              },
            },
          },
        },
      },
    );

    expect(uris).not.toContain('https://example.com/modal-stock.png');
  });

  it('keeps the x wallet-first budget under a tight global limit', () => {
    expect(
      getColdStartImageUrisFromSnapshot(
        {
          'wallet-store::ctx:tokenListSlimColdCache': {
            compactMeta: {
              wallet: {
                logoURI: 'https://example.com/wallet-token.png',
              },
            },
          },
          'swap-store::ctx:swapSelectFromTokenAtom': {
            networkId: 'evm--1',
            logoURI: 'https://example.com/swap-token.png',
            networkLogoURI: 'https://example.com/swap-network.png',
          },
        },
        2,
      ),
    ).toEqual([
      'https://example.com/wallet-token.png',
      'https://example.com/swap-token.png',
    ]);
  });

  it('releases a bounded critical wait at the exact timeout', async () => {
    jest.useFakeTimers();
    let resolveLatePreload: (() => void) | undefined;
    let settleCount = 0;
    try {
      mockPreloadImages.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveLatePreload = resolve;
          }),
      );
      const prewarmPromise = prewarmImageUris(
        ['https://example.com/slow-critical.png'],
        {
          awaitPreload: true,
          awaitPreloadTimeoutMs: 80,
          preload: true,
        },
      ).then((value) => {
        settleCount += 1;
        return value;
      });
      await Promise.resolve();
      await Promise.resolve();

      await jest.advanceTimersByTimeAsync(79);
      expect(settleCount).toBe(0);
      await jest.advanceTimersByTimeAsync(1);
      await expect(prewarmPromise).resolves.toBe(1);
      expect(settleCount).toBe(1);

      resolveLatePreload?.();
      await Promise.resolve();
      expect(settleCount).toBe(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps the current Stock pair in its own budget when the global list is full', () => {
    const snapshot = {
      'store:swap::ctx:swapSelectedTokensColdStartContextAtom': {
        accountKey: 'account-1',
      },
      'wallet-store::ctx:tokenListSlimColdCache': {
        compactMeta: Object.fromEntries(
          Array.from({ length: 48 }, (_, index) => [
            `wallet-${index}`,
            {
              logoURI: `https://example.com/wallet-${index}.png`,
              networkLogoURI: `https://example.com/wallet-network-${index}.png`,
            },
          ]),
        ),
      },
    };
    const stockDisplayStore = {
      version: 1,
      entries: {
        [encodeURIComponent('account-1')]: {
          snapshot: {
            identity: { accountKey: 'account-1' },
            selection: {
              identity: { accountKey: 'account-1' },
              stockToken: {
                logoURI: 'https://example.com/critical-stock.png',
              },
              payToken: {
                logoURI: 'https://example.com/critical-pay.png',
              },
            },
          },
        },
      },
    };

    expect(getColdStartImageUrisFromSnapshot(snapshot, 96)).not.toContain(
      'https://example.com/critical-stock.png',
    );
    expect(
      getStockColdStartImageUrisFromSnapshot(snapshot, stockDisplayStore),
    ).toEqual([
      'https://example.com/critical-stock.png',
      'https://example.com/critical-pay.png',
    ]);
  });

  it('actually prewarms the Stock budget before a full x-compatible global budget', async () => {
    const snapshot = {
      'store:swap::ctx:swapSelectedTokensColdStartContextAtom': {
        accountKey: 'account-1',
      },
      'wallet-store::ctx:tokenListSlimColdCache': {
        compactMeta: Object.fromEntries(
          Array.from({ length: 48 }, (_, index) => [
            `wallet-${index}`,
            {
              logoURI: `https://example.com/wallet-${index}.png`,
              networkLogoURI: `https://example.com/wallet-network-${index}.png`,
            },
          ]),
        ),
      },
    };
    mockGetColdStartObject.mockReturnValue({
      version: 1,
      entries: {
        [encodeURIComponent('account-1')]: {
          snapshot: {
            identity: { accountKey: 'account-1' },
            selection: {
              identity: { accountKey: 'account-1' },
              stockToken: {
                logoURI: 'https://example.com/critical-stock.png',
              },
              payToken: {
                logoURI: 'https://example.com/critical-pay.png',
              },
            },
          },
        },
      },
    });

    const primeResolvers: Array<() => void> = [];
    mockPrimeCachedImagePaths.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          primeResolvers.push(resolve);
        }),
    );
    const prewarmPromise = prewarmColdStartImagesFromSnapshot({
      awaitPreload: true,
      limit: 96,
      snapshot,
      stockCriticalOptions: { preload: true },
    });

    // The global x-compatible path must start before the critical Stock path
    // settles; otherwise two cache-prime timeouts would extend cold startup.
    expect(mockPrimeCachedImagePaths).toHaveBeenCalledTimes(2);
    expect(primeResolvers).toHaveLength(2);
    primeResolvers.forEach((resolve) => resolve());
    await expect(prewarmPromise).resolves.toBe(96);

    expect(mockPrimeCachedImagePaths.mock.calls[0]?.[0]).toEqual({
      uris: [
        'https://example.com/critical-stock.png',
        'https://example.com/critical-pay.png',
      ],
      timeoutMs: undefined,
    });
    const globalPrimeCall = mockPrimeCachedImagePaths.mock.calls[1]?.[0] as {
      uris: string[];
    };
    expect(globalPrimeCall.uris).toHaveLength(96);
    expect(globalPrimeCall.uris).not.toContain(
      'https://example.com/critical-stock.png',
    );
    expect(mockPreloadImages).toHaveBeenCalledTimes(2);
  });

  it('waits only for the critical Stock pair while global prewarm stays non-blocking', async () => {
    const snapshot = {
      'store:swap::ctx:swapSelectedTokensColdStartContextAtom': {
        accountKey: 'account-1',
      },
      'wallet-store::ctx:tokenListSlimColdCache': {
        compactMeta: {
          wallet: { logoURI: 'https://example.com/wallet.png' },
        },
      },
    };
    mockGetColdStartObject.mockReturnValue({
      version: 1,
      entries: {
        [encodeURIComponent('account-1')]: {
          snapshot: {
            identity: { accountKey: 'account-1' },
            selection: {
              identity: { accountKey: 'account-1' },
              stockToken: {
                logoURI: 'https://example.com/critical-stock.png',
              },
              payToken: {
                logoURI: 'https://example.com/critical-pay.png',
              },
            },
          },
        },
      },
    });
    let resolveCriticalPreload: (() => void) | undefined;
    mockPreloadImages.mockImplementation((sources: unknown) => {
      const serialized = JSON.stringify(sources);
      if (serialized.includes('critical-stock.png')) {
        return new Promise<void>((resolve) => {
          resolveCriticalPreload = resolve;
        });
      }
      return Promise.resolve();
    });

    let settled = false;
    const prewarmPromise = prewarmColdStartImagesFromSnapshot({
      snapshot,
      stockCriticalOptions: {
        awaitPreload: true,
        awaitPreloadTimeoutMs: 1000,
        preload: true,
      },
    }).then((value) => {
      settled = true;
      return value;
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(mockPreloadImages).toHaveBeenCalledTimes(2);
    expect(resolveCriticalPreload).toBeDefined();
    expect(settled).toBe(false);

    resolveCriticalPreload?.();
    await expect(prewarmPromise).resolves.toBe(1);
  });

  it('skips decoded iOS refs and waits only for the missing critical URI', async () => {
    mockPlatformEnv.isNativeIOS = true;
    const snapshot = {
      'store:swap::ctx:swapSelectedTokensColdStartContextAtom': {
        accountKey: 'account-1',
      },
    };
    mockGetColdStartObject.mockReturnValue({
      version: 1,
      entries: {
        [encodeURIComponent('account-1')]: {
          snapshot: {
            identity: { accountKey: 'account-1' },
            selection: {
              identity: { accountKey: 'account-1' },
              stockToken: {
                logoURI: 'https://example.com/cached-stock.png',
              },
              payToken: {
                logoURI: 'https://example.com/missing-pay.png',
              },
            },
          },
        },
      },
    });
    mockGetMissingCachedImageRefUris.mockReturnValue([]);

    await expect(
      prewarmColdStartImagesFromSnapshot({
        snapshot,
        stockCriticalOptions: {
          awaitPreload: true,
          decode: true,
          preload: false,
        },
      }),
    ).resolves.toBe(0);
    expect(mockPrimeCachedImagePaths).not.toHaveBeenCalled();
    expect(mockPrimeCachedImageRefs).not.toHaveBeenCalled();

    mockPrimeCachedImagePaths.mockClear();
    mockPrimeCachedImageRefs.mockClear();
    mockGetMissingCachedImageRefUris.mockReturnValue([
      'https://example.com/missing-pay.png',
    ]);
    let resolveMissingRef: (() => void) | undefined;
    mockPrimeCachedImageRefs.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveMissingRef = resolve;
        }),
    );
    let settled = false;
    const prewarmPromise = prewarmColdStartImagesFromSnapshot({
      snapshot,
      stockCriticalOptions: {
        awaitPreload: true,
        awaitPreloadTimeoutMs: 1000,
        decode: true,
        preload: false,
      },
    }).then(() => {
      settled = true;
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(mockPrimeCachedImagePaths).toHaveBeenCalledWith({
      uris: ['https://example.com/missing-pay.png'],
      timeoutMs: undefined,
    });
    expect(mockPrimeCachedImageRefs).toHaveBeenCalledWith({
      uris: ['https://example.com/missing-pay.png'],
      timeoutMs: undefined,
    });
    expect(settled).toBe(false);

    resolveMissingRef?.();
    await prewarmPromise;
    expect(settled).toBe(true);
  });
});
