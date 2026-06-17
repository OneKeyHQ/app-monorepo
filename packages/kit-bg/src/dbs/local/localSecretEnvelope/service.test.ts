import {
  LocalSecretEnvelopeService,
  buildLocalSecretEnvelopeLayerAdapterResolver,
  detectLocalSecretEnvelopeRuntimePlatform,
} from './service';

import type { ILocalSecretEnvelopeRuntimePlatform } from './service';
import type {
  ILocalSecretEnvelopeLayerAdapter,
  ILocalSecretEnvelopeLayerKind,
} from './types';

function buildMockLayerAdapter(
  kind: ILocalSecretEnvelopeLayerKind,
): ILocalSecretEnvelopeLayerAdapter {
  return {
    kind,
    prepareLayer: async () => ({
      alg: 'AES-256-GCM',
      capabilities: {
        extractable: kind === 'indexeddb-cryptokey' ? false : 'unknown',
        keyAccess:
          kind === 'indexeddb-cryptokey'
            ? 'opaque-decrypt'
            : 'raw-key-readable',
        sync: 'unknown',
      },
      iv: `${kind}:iv`,
      keyRef: `${kind}:key`,
      kind,
    }),
    encrypt: async ({ plaintext }) => plaintext,
    decrypt: async ({ ciphertext }) => ciphertext,
  };
}

function buildDeferred<TValue>(): {
  promise: Promise<TValue>;
  resolve: (value: TValue) => void;
} {
  let resolve: (value: TValue) => void = () => undefined;
  const promise = new Promise<TValue>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function buildService({
  indexedDbCryptoKeyAvailable,
  onIndexedDbCryptoKeyProbe,
  onSecureStorageProbe,
  platform,
  secureStorageAvailable,
}: {
  indexedDbCryptoKeyAvailable: boolean;
  onIndexedDbCryptoKeyProbe?: () => void;
  onSecureStorageProbe?: () => void;
  platform: ILocalSecretEnvelopeRuntimePlatform;
  secureStorageAvailable: boolean;
}) {
  return new LocalSecretEnvelopeService({
    buildIndexedDbCryptoKeyLayerAdapter: () =>
      buildMockLayerAdapter('indexeddb-cryptokey'),
    buildSecureStorageLayerAdapter: () =>
      buildMockLayerAdapter('secure-storage'),
    isIndexedDbCryptoKeyLayerAvailable: async () => {
      onIndexedDbCryptoKeyProbe?.();
      return indexedDbCryptoKeyAvailable;
    },
    isSecureStorageLayerAvailable: async () => {
      onSecureStorageProbe?.();
      return secureStorageAvailable;
    },
    platform,
  });
}

describe('LocalSecretEnvelopeService platform composition', () => {
  it('uses IndexedDB CryptoKey then secureStorage on desktop when both are available', async () => {
    const service = buildService({
      indexedDbCryptoKeyAvailable: true,
      platform: 'desktop',
      secureStorageAvailable: true,
    });

    const config = await service.buildCredentialMigrationConfig();

    expect(config?.runtimePlatform).toBe('desktop');
    expect(config?.strength).toBe('secure-storage-bound');
    expect(config?.layerAdapters.map((adapter) => adapter.kind)).toEqual([
      'indexeddb-cryptokey',
      'secure-storage',
    ]);
  });

  it('falls back to profile-bound desktop LSE when only IndexedDB CryptoKey is available', async () => {
    const service = buildService({
      indexedDbCryptoKeyAvailable: true,
      platform: 'desktop',
      secureStorageAvailable: false,
    });

    const config = await service.buildCredentialMigrationConfig();

    expect(config?.runtimePlatform).toBe('desktop');
    expect(config?.strength).toBe('profile-bound');
    expect(config?.layerAdapters.map((adapter) => adapter.kind)).toEqual([
      'indexeddb-cryptokey',
    ]);
  });

  it('uses only secureStorage on native and does not probe IndexedDB CryptoKey', async () => {
    let indexedDbCryptoKeyProbeCount = 0;
    let secureStorageProbeCount = 0;
    const service = buildService({
      indexedDbCryptoKeyAvailable: true,
      onIndexedDbCryptoKeyProbe: () => {
        indexedDbCryptoKeyProbeCount += 1;
      },
      onSecureStorageProbe: () => {
        secureStorageProbeCount += 1;
      },
      platform: 'native',
      secureStorageAvailable: true,
    });

    const config = await service.buildCredentialMigrationConfig();

    expect(indexedDbCryptoKeyProbeCount).toBe(0);
    expect(secureStorageProbeCount).toBe(1);
    expect(config?.runtimePlatform).toBe('native');
    expect(config?.strength).toBe('secure-storage-bound');
    expect(config?.layerAdapters.map((adapter) => adapter.kind)).toEqual([
      'secure-storage',
    ]);
  });

  it.each(['web', 'extension'] as const)(
    'uses only IndexedDB CryptoKey on %s and does not probe secureStorage',
    async (platform) => {
      let indexedDbCryptoKeyProbeCount = 0;
      let secureStorageProbeCount = 0;
      const service = buildService({
        indexedDbCryptoKeyAvailable: true,
        onIndexedDbCryptoKeyProbe: () => {
          indexedDbCryptoKeyProbeCount += 1;
        },
        onSecureStorageProbe: () => {
          secureStorageProbeCount += 1;
        },
        platform,
        secureStorageAvailable: true,
      });

      const config = await service.buildCredentialMigrationConfig();

      expect(indexedDbCryptoKeyProbeCount).toBe(1);
      expect(secureStorageProbeCount).toBe(0);
      expect(config?.runtimePlatform).toBe(platform);
      expect(config?.strength).toBe('profile-bound');
      expect(config?.layerAdapters.map((adapter) => adapter.kind)).toEqual([
        'indexeddb-cryptokey',
      ]);
    },
  );

  it('returns unavailable config when the platform has no available layer', async () => {
    const service = buildService({
      indexedDbCryptoKeyAvailable: false,
      platform: 'desktop',
      secureStorageAvailable: false,
    });

    await expect(service.buildCredentialMigrationConfig()).resolves.toBe(
      undefined,
    );
    await expect(service.buildLayerAdapterResolver()).resolves.toBe(undefined);
  });

  it('caches the credential migration config for the current service session', async () => {
    let indexedDbCryptoKeyProbeCount = 0;
    let secureStorageProbeCount = 0;
    const service = buildService({
      indexedDbCryptoKeyAvailable: true,
      onIndexedDbCryptoKeyProbe: () => {
        indexedDbCryptoKeyProbeCount += 1;
      },
      onSecureStorageProbe: () => {
        secureStorageProbeCount += 1;
      },
      platform: 'desktop',
      secureStorageAvailable: true,
    });

    const firstConfig = await service.buildCredentialMigrationConfig();
    const secondConfig = await service.buildCredentialMigrationConfig();

    expect(firstConfig).toBe(secondConfig);
    expect(indexedDbCryptoKeyProbeCount).toBe(1);
    expect(secureStorageProbeCount).toBe(1);
  });

  it('does not cache an unavailable credential migration config and re-probes on the next call', async () => {
    let indexedDbCryptoKeyProbeCount = 0;
    let indexedDbCryptoKeyAvailable = false;
    const service = new LocalSecretEnvelopeService({
      buildIndexedDbCryptoKeyLayerAdapter: () =>
        buildMockLayerAdapter('indexeddb-cryptokey'),
      isIndexedDbCryptoKeyLayerAvailable: async () => {
        indexedDbCryptoKeyProbeCount += 1;
        return indexedDbCryptoKeyAvailable;
      },
      platform: 'web',
    });

    // A transient unavailable probe (e.g. keychain busy at cold start) must NOT
    // be frozen for the whole session: caching it would block unwrapping every
    // LSE-wrapped credential/verifyString until restart.
    await expect(service.buildCredentialMigrationConfig()).resolves.toBe(
      undefined,
    );
    expect(indexedDbCryptoKeyProbeCount).toBe(1);

    // The next call re-probes and recovers once the capability is available.
    indexedDbCryptoKeyAvailable = true;
    const config = await service.buildCredentialMigrationConfig();
    expect(indexedDbCryptoKeyProbeCount).toBe(2);
    expect(config?.layerAdapters.map((adapter) => adapter.kind)).toEqual([
      'indexeddb-cryptokey',
    ]);
  });

  it('deduplicates concurrent credential migration config probes', async () => {
    let indexedDbCryptoKeyProbeCount = 0;
    const availability = buildDeferred<boolean>();
    const service = new LocalSecretEnvelopeService({
      buildIndexedDbCryptoKeyLayerAdapter: () =>
        buildMockLayerAdapter('indexeddb-cryptokey'),
      isIndexedDbCryptoKeyLayerAvailable: async () => {
        indexedDbCryptoKeyProbeCount += 1;
        return availability.promise;
      },
      platform: 'web',
    });

    const firstConfigPromise = service.buildCredentialMigrationConfig();
    const secondConfigPromise = service.buildCredentialMigrationConfig();

    await Promise.resolve();
    expect(indexedDbCryptoKeyProbeCount).toBe(1);

    availability.resolve(true);
    const [firstConfig, secondConfig] = await Promise.all([
      firstConfigPromise,
      secondConfigPromise,
    ]);
    expect(firstConfig).toBe(secondConfig);
    expect(firstConfig?.layerAdapters.map((adapter) => adapter.kind)).toEqual([
      'indexeddb-cryptokey',
    ]);
  });

  it('rebuilds credential migration config after clearing the capability cache', async () => {
    let indexedDbCryptoKeyProbeCount = 0;
    const indexedDbCryptoKeyAvailable = true;
    const service = new LocalSecretEnvelopeService({
      buildIndexedDbCryptoKeyLayerAdapter: () =>
        buildMockLayerAdapter('indexeddb-cryptokey'),
      isIndexedDbCryptoKeyLayerAvailable: async () => {
        indexedDbCryptoKeyProbeCount += 1;
        return indexedDbCryptoKeyAvailable;
      },
      platform: 'web',
    });

    // A resolved (defined) config is cached for the session and not re-probed.
    const firstConfig = await service.buildCredentialMigrationConfig();
    const cachedConfig = await service.buildCredentialMigrationConfig();
    expect(firstConfig).toBe(cachedConfig);
    expect(indexedDbCryptoKeyProbeCount).toBe(1);

    // clearCapabilityCache forces a fresh probe even for an already-cached
    // config (used by the read path to retry a degraded/stale capability set).
    service.clearCapabilityCache();
    const config = await service.buildCredentialMigrationConfig();

    expect(indexedDbCryptoKeyProbeCount).toBe(2);
    expect(config?.layerAdapters.map((adapter) => adapter.kind)).toEqual([
      'indexeddb-cryptokey',
    ]);
  });

  it('rebuilds credential migration config after clearing only the config cache', async () => {
    let indexedDbCryptoKeyProbeCount = 0;
    const service = new LocalSecretEnvelopeService({
      buildIndexedDbCryptoKeyLayerAdapter: () =>
        buildMockLayerAdapter('indexeddb-cryptokey'),
      isIndexedDbCryptoKeyLayerAvailable: async () => {
        indexedDbCryptoKeyProbeCount += 1;
        return true;
      },
      platform: 'web',
    });

    const firstConfig = await service.buildCredentialMigrationConfig();
    const cachedConfig = await service.buildCredentialMigrationConfig();
    expect(firstConfig).toBe(cachedConfig);
    expect(indexedDbCryptoKeyProbeCount).toBe(1);

    // The read path clears ONLY the config cache (not the secureStorage probe
    // failure backoff) to rebuild a degraded/stale config; the config is rebuilt
    // on the next call.
    service.clearCredentialMigrationConfigCache();
    const config = await service.buildCredentialMigrationConfig();

    expect(indexedDbCryptoKeyProbeCount).toBe(2);
    expect(config?.layerAdapters.map((adapter) => adapter.kind)).toEqual([
      'indexeddb-cryptokey',
    ]);
  });

  it('builds layer resolvers by persisted layer kind', () => {
    const indexedDbCryptoKeyAdapter = buildMockLayerAdapter(
      'indexeddb-cryptokey',
    );
    const secureStorageAdapter = buildMockLayerAdapter('secure-storage');
    const resolver = buildLocalSecretEnvelopeLayerAdapterResolver([
      indexedDbCryptoKeyAdapter,
      secureStorageAdapter,
    ]);

    expect(
      resolver?.({
        alg: 'AES-256-GCM',
        capabilities: {
          extractable: false,
          keyAccess: 'opaque-decrypt',
          sync: 'unknown',
        },
        keyRef: 'indexeddb:key',
        kind: 'indexeddb-cryptokey',
      }),
    ).toBe(indexedDbCryptoKeyAdapter);
    expect(
      resolver?.({
        alg: 'AES-256-GCM',
        capabilities: {
          extractable: 'unknown',
          keyAccess: 'raw-key-readable',
          sync: 'unknown',
        },
        keyRef: 'secure-storage:key',
        kind: 'secure-storage',
      }),
    ).toBe(secureStorageAdapter);
    expect(buildLocalSecretEnvelopeLayerAdapterResolver([])).toBe(undefined);
  });

  it('detects runtime platform from platformEnv flags', () => {
    expect(
      detectLocalSecretEnvelopeRuntimePlatform({
        isDesktop: true,
      }),
    ).toBe('desktop');
    expect(
      detectLocalSecretEnvelopeRuntimePlatform({
        isNative: true,
      }),
    ).toBe('native');
    expect(
      detectLocalSecretEnvelopeRuntimePlatform({
        isExtension: true,
      }),
    ).toBe('extension');
    expect(
      detectLocalSecretEnvelopeRuntimePlatform({
        isWeb: true,
      }),
    ).toBe('web');
    expect(
      detectLocalSecretEnvelopeRuntimePlatform({
        isWebEmbed: true,
      }),
    ).toBe('web');
    expect(detectLocalSecretEnvelopeRuntimePlatform({})).toBe('unknown');
  });
});
