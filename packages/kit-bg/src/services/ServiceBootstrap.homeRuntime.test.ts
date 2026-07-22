import { HOME_RUNTIME_PROTOCOL_VERSION } from '@onekeyhq/shared/src/types/homeRuntime';

import ServiceBootstrap, {
  createHomeRuntimeProducerInstanceId,
} from './ServiceBootstrap';

type IMockStorageGlobal = typeof globalThis & {
  __homeStoreCacheMockStorage?: Map<string, string>;
};

function mockGetStorage(): Map<string, string> {
  const target = globalThis as IMockStorageGlobal;
  target.__homeStoreCacheMockStorage ??= new Map<string, string>();
  return target.__homeStoreCacheMockStorage;
}

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass:
    () =>
    <T extends abstract new (...args: never[]) => unknown>(constructor: T) =>
      constructor,
  backgroundMethod:
    () =>
    (_target: object, _methodName: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundMethodForDev:
    () =>
    (_target: object, _methodName: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('@onekeyhq/shared/src/storage/appStorage', () => {
  const storage = mockGetStorage();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => storage.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        storage.set(key, value);
      }),
      removeItem: jest.fn(async (key: string) => {
        storage.delete(key);
      }),
    },
  };
});

jest.mock('@onekeyhq/shared/src/utils/systemTimeUtils', () => ({
  __esModule: true,
  default: { startServerTimeInterval: jest.fn() },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: {
      bootstrap: {
        initCriticalStep: jest.fn(),
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isDesktop: false, isExtension: false, isWeb: false },
}));

jest.mock('../dbs/local/localDb', () => ({
  __esModule: true,
  default: { readyDb: Promise.resolve() },
}));

jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class MockServiceBase {
    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }

    backgroundApi: unknown;
  },
}));

describe('ServiceBootstrap Home runtime handshake', () => {
  beforeEach(() => {
    mockGetStorage().clear();
    jest.clearAllMocks();
  });

  it('returns one immutable producer identity for the current bg boot', async () => {
    const first = new ServiceBootstrap({ backgroundApi: {} });
    const second = new ServiceBootstrap({ backgroundApi: {} });

    await expect(first.getHomeRuntimeHandshake()).resolves.toEqual({
      protocolVersion: HOME_RUNTIME_PROTOCOL_VERSION,
      producerInstanceId: expect.stringMatching(/^home-bg-/),
    });
    await expect(second.getHomeRuntimeHandshake()).resolves.toEqual(
      await first.getHomeRuntimeHandshake(),
    );
  });

  it('creates a distinct producer identity for a different bg boot', () => {
    expect(createHomeRuntimeProducerInstanceId()).not.toBe(
      createHomeRuntimeProducerInstanceId(),
    );
  });

  it('persists the Home snapshot envelope without decoding its opaque payload', async () => {
    const service = new ServiceBootstrap({ backgroundApi: {} });
    const now = Date.now();
    const envelope = {
      key: 'owner-a',
      schemaVersion: 1 as const,
      ownerScopeKey: 'scope-a',
      createdAt: now,
      expiresAt: now + 60_000,
      payload: 'kit-owned-opaque-payload',
    };

    await expect(service.persistHomeStoreCache(envelope)).resolves.toBe(true);
    await expect(service.loadHomeStoreCache(envelope.key)).resolves.toEqual(
      envelope,
    );

    await service.removeHomeStoreCache(envelope.key);
    await expect(
      service.loadHomeStoreCache(envelope.key),
    ).resolves.toBeUndefined();
  });

  it('serializes concurrent cache index updates', async () => {
    const service = new ServiceBootstrap({ backgroundApi: {} });
    const now = Date.now();
    const createEnvelope = (key: string) => ({
      key,
      schemaVersion: 1 as const,
      ownerScopeKey: `scope-${key}`,
      createdAt: now,
      expiresAt: now + 60_000,
      payload: `opaque-${key}`,
    });

    await Promise.all([
      service.persistHomeStoreCache(createEnvelope('owner-a')),
      service.persistHomeStoreCache(createEnvelope('owner-b')),
    ]);

    expect(
      JSON.parse(mockGetStorage().get('$$home-store-cache-v1:index') ?? '[]'),
    ).toEqual(['owner-a', 'owner-b']);
  });

  it('evicts the least-recently-used entry beyond the eight-owner bound', async () => {
    const service = new ServiceBootstrap({ backgroundApi: {} });
    const now = Date.now();
    const createEnvelope = (index: number) => ({
      key: `owner-${index}`,
      schemaVersion: 1 as const,
      ownerScopeKey: `scope-${index}`,
      createdAt: now,
      expiresAt: now + 60_000,
      payload: `opaque-${index}`,
    });

    for (let index = 0; index < 9; index += 1) {
      await service.persistHomeStoreCache(createEnvelope(index));
    }

    expect(
      JSON.parse(mockGetStorage().get('$$home-store-cache-v1:index') ?? '[]'),
    ).toEqual(Array.from({ length: 8 }, (_, index) => `owner-${index + 1}`));
    expect(mockGetStorage().has('$$home-store-cache-v1:owner-0')).toBe(false);
    expect(mockGetStorage().has('$$home-store-cache-v1:owner-8')).toBe(true);
  });

  it('physically removes expired and malformed cache entries on load', async () => {
    const service = new ServiceBootstrap({ backgroundApi: {} });
    const storage = mockGetStorage();
    storage.set(
      '$$home-store-cache-v1:expired',
      JSON.stringify({
        key: 'expired',
        schemaVersion: 1,
        ownerScopeKey: 'scope-expired',
        createdAt: 1,
        expiresAt: 2,
        payload: 'expired',
      }),
    );
    storage.set('$$home-store-cache-v1:malformed', '{');
    storage.set(
      '$$home-store-cache-v1:index',
      JSON.stringify(['expired', 'malformed']),
    );

    await expect(
      service.loadHomeStoreCache('expired'),
    ).resolves.toBeUndefined();
    await expect(
      service.loadHomeStoreCache('malformed'),
    ).resolves.toBeUndefined();
    expect(storage.has('$$home-store-cache-v1:expired')).toBe(false);
    expect(storage.has('$$home-store-cache-v1:malformed')).toBe(false);
    expect(
      JSON.parse(storage.get('$$home-store-cache-v1:index') ?? '[]'),
    ).toEqual([]);
  });
});
