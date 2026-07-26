import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IIpTableConfigWithRuntime,
  ISniResponse,
} from '@onekeyhq/shared/src/request/types/ipTable';

import {
  type IFirmwareManifestCacheRecord,
  type ISimpleDbFirmwareManifestCacheData,
  SimpleDbEntityFirmwareManifestCache,
} from '../../dbs/simple/entity/SimpleDbEntityFirmwareManifestCache';

import {
  trustedFirmwareCatalogMetadata,
  trustedFirmwareCatalogSnapshotJsonByKey,
} from './catalog/trustedFirmwareCatalog.generated';
import {
  FirmwareManifestProvider,
  type IFirmwareManifestProviderDependencies,
} from './FirmwareManifestProvider';

import type {
  IFirmwareManifestCoreSdk,
  IFirmwareManifestSelection,
  IFirmwareManifestSnapshot,
} from './firmwareUpdateCoordinatorTypes';

const SELECTION: IFirmwareManifestSelection = {
  channel: 'stable',
  deviceModel: 'classic1s',
  firmwareField: 'firmware-v8',
  firmwareType: 'universal',
};
const KEY = 'stable:classic1s:firmware-v8:universal';
const INDEX = trustedFirmwareCatalogMetadata.snapshotIndex.find(
  (entry) => entry.key === KEY,
);
if (!INDEX) {
  throw new OneKeyLocalError(`Test catalog entry ${KEY} is missing`);
}
const SNAPSHOT_JSON = trustedFirmwareCatalogSnapshotJsonByKey[INDEX.key];
if (!SNAPSHOT_JSON) {
  throw new OneKeyLocalError(`Test catalog snapshot ${INDEX.key} is missing`);
}

const REMOTE_SELECTION = [
  {
    required: false,
    version: [4, 10, 0],
    url: 'https://web.onekey-asset.com/classic1s.signed.bin',
  },
];
const REMOTE_MANIFEST_BODY = JSON.stringify({
  classic1s: {
    'firmware-v8': REMOTE_SELECTION,
  },
});

const createIpTableConfig = (): IIpTableConfigWithRuntime => ({
  config: {
    version: 1,
    ttl_sec: 300,
    generated_at: '2026-07-25T00:00:00.000Z',
    source: 'signed-remote',
    sourcePayloadHash: 'source-payload-hash',
    domains: {
      'data.onekey.so': {
        endpoints: [
          {
            ip: '3.3.3.3',
            provider: 'weighted',
            region: 'ALL',
            weight: 10,
          },
          {
            ip: '1.1.1.1',
            provider: 'selected',
            region: 'ALL',
            weight: 5,
          },
          {
            ip: '2.2.2.2',
            provider: 'last-best',
            region: 'ALL',
            weight: 1,
          },
        ],
      },
    },
  },
  runtime: {
    enabled: true,
    lastUpdated: 0,
    lastRegionCheck: 0,
    selections: {
      'data.onekey.so': '1.1.1.1',
    },
    lastBestIp: {
      'data.onekey.so': '2.2.2.2',
    },
  },
});

const createSniResponse = ({
  statusCode = 200,
  body = REMOTE_MANIFEST_BODY,
  contentType = 'application/json',
}: {
  statusCode?: number;
  body?: string;
  contentType?: string;
} = {}): ISniResponse => ({
  statusCode,
  headers: {
    'content-type': contentType,
  },
  body,
});

const createCoreSdk = ({
  sourceSelectionDigest = INDEX.sourceSelectionDigest,
}: {
  sourceSelectionDigest?: string;
} = {}): IFirmwareManifestCoreSdk =>
  ({
    sha256CanonicalFirmwareJson: jest.fn(() => sourceSelectionDigest),
    validateFirmwareManifestSnapshot: jest.fn((value: unknown) => {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new OneKeyLocalError('invalid snapshot');
      }
      return value as IFirmwareManifestSnapshot;
    }),
    computeFirmwareManifestSnapshotDigest: jest.fn((value: unknown) => {
      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        'corrupted' in value
      ) {
        return 'b'.repeat(64);
      }
      return (value as IFirmwareManifestSnapshot).snapshotDigest;
    }),
    deepFreezeFirmwareValue: jest.fn(<T>(value: T) => value),
  }) as unknown as IFirmwareManifestCoreSdk;

const setupCache = (initial?: ISimpleDbFirmwareManifestCacheData) => {
  const cache = new SimpleDbEntityFirmwareManifestCache();
  let store = initial;
  jest.spyOn(cache, 'getRawData').mockImplementation(async () => store);
  jest.spyOn(cache, 'setRawData').mockImplementation(async (builder) => {
    store =
      typeof builder === 'function'
        ? await builder(store)
        : (builder as ISimpleDbFirmwareManifestCacheData);
    return store;
  });
  return { cache, getStore: () => store };
};

const createCacheRecord = (
  overrides: Partial<IFirmwareManifestCacheRecord> = {},
): IFirmwareManifestCacheRecord => ({
  key: INDEX.key,
  catalogLineage: INDEX.catalogLineage,
  channel: INDEX.channel,
  catalogEpoch: INDEX.catalogEpoch,
  projectionDigest: INDEX.projectionDigest,
  sourceSelectionDigest: INDEX.sourceSelectionDigest,
  snapshotDigest: INDEX.snapshotDigest,
  snapshotJson: SNAPSHOT_JSON,
  acceptedAt: 100,
  ...overrides,
});

const createDependencies = ({
  cache = setupCache().cache,
  coreSdk = createCoreSdk(),
  sniResponse = createSniResponse(),
}: {
  cache?: SimpleDbEntityFirmwareManifestCache;
  coreSdk?: IFirmwareManifestCoreSdk;
  sniResponse?: ISniResponse | null;
} = {}) => {
  const sniRequest = jest.fn<
    ReturnType<IFirmwareManifestProviderDependencies['sniRequest']>,
    Parameters<IFirmwareManifestProviderDependencies['sniRequest']>
  >(async () => sniResponse);
  const domainRequest = jest.fn<
    ReturnType<IFirmwareManifestProviderDependencies['domainRequest']>,
    Parameters<IFirmwareManifestProviderDependencies['domainRequest']>
  >(async () => ({
    statusCode: 200,
    headers: {
      'content-type': 'application/json',
    },
    body: REMOTE_MANIFEST_BODY,
    finalUrl: 'https://data.onekey.so/config.json',
  }));
  const dependencies: IFirmwareManifestProviderDependencies = {
    now: () => 1000,
    loadCoreSdk: async () => coreSdk,
    getIpTableConfig: async () => createIpTableConfig(),
    isSniSupported: () => true,
    isProxyActiveForUrl: async () => false,
    sniRequest,
    domainRequest,
    getRequestHeaders: async () => ({}),
    cache,
  };
  return {
    dependencies,
    sniRequest,
    domainRequest,
  };
};

describe('FirmwareManifestProvider', () => {
  it('tries selected, last-best, and weighted SNI candidates before the domain', async () => {
    const { cache, getStore } = setupCache();
    const { dependencies, sniRequest, domainRequest } = createDependencies({
      cache,
    });
    sniRequest
      .mockResolvedValueOnce(createSniResponse({ statusCode: 503 }))
      .mockRejectedValueOnce(new OneKeyLocalError('unreachable'))
      .mockResolvedValueOnce(createSniResponse());

    const result = await new FirmwareManifestProvider(
      dependencies,
    ).loadManifest(SELECTION);

    expect(result.source).toBe('verified-remote');
    expect(sniRequest.mock.calls.map(([request]) => request.ip)).toEqual([
      '1.1.1.1',
      '2.2.2.2',
      '3.3.3.3',
    ]);
    expect(domainRequest).not.toHaveBeenCalled();
    expect(getStore()?.lastGoodByKey[KEY]).toMatchObject({
      snapshotDigest: INDEX.snapshotDigest,
      sourceSelectionDigest: INDEX.sourceSelectionDigest,
    });
  });

  it('uses the canonical domain through an active proxy without bypassing it', async () => {
    const { dependencies, sniRequest, domainRequest } = createDependencies();
    dependencies.isProxyActiveForUrl = async () => true;

    const result = await new FirmwareManifestProvider(
      dependencies,
    ).loadManifest(SELECTION);

    expect(result.source).toBe('verified-remote');
    expect(sniRequest).not.toHaveBeenCalled();
    expect(domainRequest).toHaveBeenCalledTimes(1);
  });

  it('falls back to the bundled snapshot when the remote selection digest is unknown', async () => {
    const { cache, getStore } = setupCache();
    const { dependencies } = createDependencies({
      cache,
      coreSdk: createCoreSdk({
        sourceSelectionDigest: 'b'.repeat(64),
      }),
    });

    const result = await new FirmwareManifestProvider(
      dependencies,
    ).loadManifest(SELECTION);

    expect(result.source).toBe('app-bundled-catalog');
    expect(getStore()?.lastGoodByKey).toEqual({});
  });

  it('rejects duplicate JSON keys before catalog admission', async () => {
    const { dependencies, domainRequest } = createDependencies({
      sniResponse: createSniResponse({
        body: `{"classic1s":{"firmware-v8":[],"firmware-v8":[]}}`,
      }),
    });

    const result = await new FirmwareManifestProvider(
      dependencies,
    ).loadManifest(SELECTION);

    expect(result.source).toBe('app-bundled-catalog');
    expect(domainRequest).not.toHaveBeenCalled();
  });

  it('enforces the firmware-specific 1 MiB text response cap', async () => {
    const { dependencies, domainRequest } = createDependencies({
      sniResponse: createSniResponse({
        body: 'x'.repeat(1024 * 1024 + 1),
      }),
    });

    const result = await new FirmwareManifestProvider(
      dependencies,
    ).loadManifest(SELECTION);

    expect(result.source).toBe('app-bundled-catalog');
    expect(domainRequest).not.toHaveBeenCalled();
  });

  it('rejects a canonical response redirected across hosts', async () => {
    const { dependencies, sniRequest } = createDependencies();
    dependencies.isProxyActiveForUrl = async () => true;
    dependencies.domainRequest = jest.fn(async () => ({
      statusCode: 200,
      headers: {
        'content-type': 'application/json',
      },
      body: REMOTE_MANIFEST_BODY,
      finalUrl: 'https://attacker.example/config.json',
    }));

    const result = await new FirmwareManifestProvider(
      dependencies,
    ).loadManifest(SELECTION);

    expect(result.source).toBe('app-bundled-catalog');
    expect(sniRequest).not.toHaveBeenCalled();
  });

  it('revalidates and uses a current last-good snapshot when the network is unavailable', async () => {
    const { cache } = setupCache();
    await cache.saveLastGood(createCacheRecord());
    const { dependencies } = createDependencies({
      cache,
      sniResponse: null,
    });
    dependencies.domainRequest = jest.fn(async () => {
      throw new OneKeyLocalError('offline');
    });

    const result = await new FirmwareManifestProvider(
      dependencies,
    ).loadManifest(SELECTION);

    expect(result.source).toBe('last-good-cache');
    expect(result.snapshotDigest).toBe(INDEX.snapshotDigest);
  });

  it('rejects a corrupted last-good payload and uses the bundled snapshot', async () => {
    const { cache } = setupCache();
    const corrupted = JSON.parse(SNAPSHOT_JSON) as Record<string, unknown>;
    corrupted.corrupted = true;
    await cache.saveLastGood(
      createCacheRecord({
        snapshotJson: JSON.stringify(corrupted),
      }),
    );
    const { dependencies } = createDependencies({
      cache,
      sniResponse: null,
    });
    dependencies.domainRequest = jest.fn(async () => {
      throw new OneKeyLocalError('offline');
    });

    const result = await new FirmwareManifestProvider(
      dependencies,
    ).loadManifest(SELECTION);

    expect(result.source).toBe('app-bundled-catalog');
  });

  it('blocks a downgraded App catalog before network access', async () => {
    const scopeKey = `${INDEX.catalogLineage}\u0000${INDEX.channel}`;
    const { cache } = setupCache({
      version: 1,
      highestAcceptedByScope: {
        [scopeKey]: {
          catalogEpoch: INDEX.catalogEpoch + 1,
          acceptedAt: 100,
        },
      },
      lastGoodByKey: {},
    });
    const { dependencies, sniRequest, domainRequest } = createDependencies({
      cache,
    });

    await expect(
      new FirmwareManifestProvider(dependencies).loadManifest(SELECTION),
    ).rejects.toMatchObject({
      firmwareManifestCode: 'CATALOG_ROLLBACK',
    });
    expect(sniRequest).not.toHaveBeenCalled();
    expect(domainRequest).not.toHaveBeenCalled();
  });

  it('deduplicates concurrent loads in the bg runtime', async () => {
    const { dependencies, sniRequest } = createDependencies();
    const provider = new FirmwareManifestProvider(dependencies);

    const first = provider.loadManifest(SELECTION);
    const second = provider.loadManifest(SELECTION);
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult).toBe(secondResult);
    expect(sniRequest).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the requested channel has no reviewed catalog entry', async () => {
    const { dependencies } = createDependencies();

    await expect(
      new FirmwareManifestProvider(dependencies).loadManifest({
        ...SELECTION,
        channel: 'pre-release',
      }),
    ).rejects.toMatchObject({
      firmwareManifestCode: 'CATALOG_ENTRY_MISSING',
    });
  });
});
