type IFakeIdentityImageDisk = Record<string, string>;

const fakeDiskGlobal = globalThis as typeof globalThis & {
  __identityImageFakeDisk?: IFakeIdentityImageDisk;
};

jest.mock('../storage/instance/syncStorageInstance', () => {
  const readDisk = () =>
    (
      globalThis as {
        __identityImageFakeDisk?: IFakeIdentityImageDisk;
      }
    ).__identityImageFakeDisk ?? {};
  const storage = {
    set: () => {},
    setObject: (key: string, value: Record<string, unknown>) => {
      readDisk()[key] = JSON.stringify(value);
    },
    getObject: (key: string) => {
      const raw = readDisk()[key];
      return raw === undefined
        ? undefined
        : (JSON.parse(raw) as Record<string, unknown>);
    },
    getString: (key: string) => readDisk()[key],
    getNumber: () => undefined,
    getBoolean: () => undefined,
    delete: (key: string) => {
      delete readDisk()[key];
    },
    clearAll: () => {
      const disk = readDisk();
      Object.keys(disk).forEach((key) => delete disk[key]);
    },
    getAllKeys: () => Object.keys(readDisk()),
  };
  return {
    __esModule: true,
    coldStartCacheStorage: storage,
    syncStorage: storage,
  };
});

function loadFreshRuntime() {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./identityImageUrlCache') as typeof import('./identityImageUrlCache');
}

describe('identityImageUrlCache', () => {
  beforeEach(() => {
    fakeDiskGlobal.__identityImageFakeDisk = {};
  });

  afterEach(() => {
    delete fakeDiskGlobal.__identityImageFakeDisk;
    jest.useRealTimers();
  });

  it('normalizes token addresses and keeps native tokens on an explicit sentinel', () => {
    const runtime = loadFreshRuntime();

    expect(
      runtime.buildTokenImageIdentity({
        contractAddress: ' 0xAbCd ',
        networkId: 'evm--1',
      }),
    ).toBe(
      runtime.buildTokenImageIdentity({
        contractAddress: '0xabcd',
        networkId: 'evm--1',
      }),
    );
    expect(
      runtime.buildTokenImageIdentity({
        contractAddress: 'AbCd',
        networkId: 'sol--101',
      }),
    ).not.toBe(
      runtime.buildTokenImageIdentity({
        contractAddress: 'abcd',
        networkId: 'sol--101',
      }),
    );
    expect(
      runtime.buildTokenImageIdentity({
        contractAddress: '0xignored',
        isNative: true,
        networkId: 'evm--1',
      }),
    ).not.toBe(
      runtime.buildTokenImageIdentity({
        contractAddress: '0xignored',
        networkId: 'evm--1',
      }),
    );
  });

  it('keeps Market metadata isolated by locale and scope', () => {
    const runtime = loadFreshRuntime();

    expect(
      runtime.buildMarketImageIdentity({
        identity: 'AAPL',
        locale: 'en-US',
        scope: 'stock',
      }),
    ).not.toBe(
      runtime.buildMarketImageIdentity({
        identity: 'AAPL',
        locale: 'zh-CN',
        scope: 'stock',
      }),
    );
    expect(
      runtime.buildMarketImageIdentity({
        identity: 'AAPL',
        locale: 'en-US',
        scope: 'stock',
      }),
    ).not.toBe(
      runtime.buildMarketImageIdentity({
        identity: 'AAPL',
        locale: 'en-US',
        scope: 'token',
      }),
    );
  });

  it('lets a fresh main runtime synchronously read a background MMKV write', () => {
    const backgroundRuntime = loadFreshRuntime();
    const identity = backgroundRuntime.buildNetworkImageIdentity('evm--1');
    backgroundRuntime.persistIdentityImageUrlsFromBackground([
      { identity, url: 'https://example.com/ethereum.png' },
    ]);

    const mainRuntime = loadFreshRuntime();
    expect(mainRuntime.getIdentityImageUrl(identity)).toBe(
      'https://example.com/ethereum.png',
    );
  });

  it('does not turn a cached Promise into a synchronous value without a background write', async () => {
    const identity = 'network:evm--1';
    const memoizedRequest = Promise.resolve('https://example.com/ethereum.png');
    await memoizedRequest;

    const mainRuntime = loadFreshRuntime();
    expect(mainRuntime.getIdentityImageUrl(identity)).toBe('');
  });

  it('keeps the last-good URL when revalidation returns an empty value', () => {
    const runtime = loadFreshRuntime();
    const identity = runtime.buildNetworkImageIdentity('evm--1');
    runtime.persistIdentityImageUrlsFromBackground([
      { identity, url: 'https://example.com/ethereum.png' },
    ]);
    runtime.persistIdentityImageUrlsFromBackground([{ identity, url: '' }]);
    runtime.resetIdentityImageUrlCacheState();

    expect(runtime.getIdentityImageUrl(identity)).toBe(
      'https://example.com/ethereum.png',
    );
  });

  it('observes a background URL replacement after the main read throttle', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const firstBackgroundRuntime = loadFreshRuntime();
    const identity = firstBackgroundRuntime.buildNetworkImageIdentity('evm--1');
    firstBackgroundRuntime.persistIdentityImageUrlsFromBackground([
      { identity, url: 'https://example.com/old.png' },
    ]);
    const mainRuntime = loadFreshRuntime();
    expect(mainRuntime.getIdentityImageUrl(identity)).toBe(
      'https://example.com/old.png',
    );

    const nextBackgroundRuntime = loadFreshRuntime();
    nextBackgroundRuntime.persistIdentityImageUrlsFromBackground([
      { identity, url: 'https://example.com/new.png' },
    ]);
    jest.advanceTimersByTime(1000);

    expect(mainRuntime.getIdentityImageUrl(identity)).toBe(
      'https://example.com/new.png',
    );
  });

  it('does not reuse a URL after the semantic identity changes', () => {
    const runtime = loadFreshRuntime();
    const firstIdentity = runtime.buildTokenImageIdentity({
      contractAddress: '0xfirst',
      networkId: 'evm--1',
    });
    const secondIdentity = runtime.buildTokenImageIdentity({
      contractAddress: '0xsecond',
      networkId: 'evm--1',
    });
    runtime.rememberIdentityImageUrl({
      identity: firstIdentity,
      url: 'https://example.com/first.png',
    });

    expect(runtime.getIdentityImageUrl(secondIdentity)).toBe('');
  });

  it('lets the current owner URL override a persisted value in main memory', () => {
    const runtime = loadFreshRuntime();
    const identity = runtime.buildNetworkImageIdentity('evm--1');
    runtime.persistIdentityImageUrlsFromBackground([
      { identity, url: 'https://example.com/old.png' },
    ]);

    expect(
      runtime.resolveIdentityImageUrl({
        identity,
        ownerUrl: 'https://example.com/new.png',
      }),
    ).toBe('https://example.com/new.png');
    expect(runtime.getIdentityImageUrl(identity)).toBe(
      'https://example.com/new.png',
    );
  });

  it('supports explicit background replacement and invalidation', () => {
    const runtime = loadFreshRuntime();
    const identity = runtime.buildNetworkImageIdentity('custom--1');
    runtime.replaceIdentityImageUrlFromBackground({
      identity,
      url: 'https://example.com/custom.png',
    });
    runtime.replaceIdentityImageUrlFromBackground({ identity, url: '' });
    runtime.resetIdentityImageUrlCacheState();

    expect(runtime.getIdentityImageUrl(identity)).toBe('');
  });

  it('bounds the persistent registry by least-recently-written entries', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const runtime = loadFreshRuntime();
    const writes = Array.from({ length: 769 }, (_, index) => ({
      identity: `token:evm--1:0x${index}`,
      url: `https://example.com/${index}.png`,
    }));

    runtime.persistIdentityImageUrlsFromBackground(writes);
    runtime.resetIdentityImageUrlCacheState();

    expect(runtime.getIdentityImageUrl(writes[0].identity)).toBe('');
    expect(runtime.getIdentityImageUrl(writes.at(-1)?.identity)).toBe(
      writes.at(-1)?.url,
    );
  });
});
