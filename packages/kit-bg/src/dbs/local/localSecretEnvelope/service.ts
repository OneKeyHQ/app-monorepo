import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IPlatformEnv } from '@onekeyhq/shared/src/platformEnv';

import {
  buildIndexedDbCryptoKeyLocalSecretEnvelopeLayerAdapter,
  isIndexedDbCryptoKeyLocalSecretEnvelopeLayerAvailable,
} from './indexedDbCryptoKeyLayerAdapter';
import { parseLocalSecretEnvelopeV1 } from './parser';
import {
  buildSecureStorageLocalSecretEnvelopeLayerAdapter,
  isSecureStorageLocalSecretEnvelopeLayerAvailable,
  resetSecureStorageLocalSecretEnvelopeProbeCache,
} from './secureStorageLayerAdapter';

import type {
  ILocalSecretEnvelopeLayerAdapter,
  ILocalSecretEnvelopeLayerAdapterResolver,
  ILocalSecretEnvelopeStrength,
} from './types';

export type ILocalSecretEnvelopeRuntimePlatform =
  | 'desktop'
  | 'native'
  | 'extension'
  | 'web'
  | 'unknown';

export type ILocalSecretEnvelopeCredentialMigrationConfig = {
  layerAdapters: ILocalSecretEnvelopeLayerAdapter[];
  runtimePlatform?: ILocalSecretEnvelopeRuntimePlatform;
  strength: ILocalSecretEnvelopeStrength;
};

type ILocalSecretEnvelopeLayerProvider = {
  buildLayerAdapter: () => ILocalSecretEnvelopeLayerAdapter;
  isAvailable: () => Promise<boolean>;
};

type ILocalSecretEnvelopeServiceParams = {
  buildIndexedDbCryptoKeyLayerAdapter?: () => ILocalSecretEnvelopeLayerAdapter;
  buildSecureStorageLayerAdapter?: () => ILocalSecretEnvelopeLayerAdapter;
  isIndexedDbCryptoKeyLayerAvailable?: () => Promise<boolean>;
  isSecureStorageLayerAvailable?: () => Promise<boolean>;
  platform?: ILocalSecretEnvelopeRuntimePlatform;
  platformEnv?: Pick<
    IPlatformEnv,
    'isDesktop' | 'isNative' | 'isExtension' | 'isWeb' | 'isWebEmbed'
  >;
};

type ILocalSecretEnvelopeCredentialMigrationConfigCache = {
  value: ILocalSecretEnvelopeCredentialMigrationConfig | undefined;
};

export function detectLocalSecretEnvelopeRuntimePlatform(
  env: Pick<
    IPlatformEnv,
    'isDesktop' | 'isNative' | 'isExtension' | 'isWeb' | 'isWebEmbed'
  > = platformEnv,
): ILocalSecretEnvelopeRuntimePlatform {
  if (env.isDesktop) {
    return 'desktop';
  }
  if (env.isNative) {
    return 'native';
  }
  if (env.isExtension) {
    return 'extension';
  }
  if (env.isWeb || env.isWebEmbed) {
    return 'web';
  }
  return 'unknown';
}

export function buildLocalSecretEnvelopeLayerAdapterResolver(
  layerAdapters: ILocalSecretEnvelopeLayerAdapter[],
): ILocalSecretEnvelopeLayerAdapterResolver | undefined {
  if (!layerAdapters.length) {
    return undefined;
  }
  const adaptersByKind = new Map(
    layerAdapters.map((adapter) => [adapter.kind, adapter]),
  );
  return (layer) => adaptersByKind.get(layer.kind);
}

export async function cleanupLocalSecretEnvelopeLayerKeysBestEffort({
  envelope,
  layerAdapters,
}: {
  envelope: string;
  layerAdapters: ILocalSecretEnvelopeLayerAdapter[];
}): Promise<void> {
  let parsed: ReturnType<typeof parseLocalSecretEnvelopeV1>;
  try {
    parsed = parseLocalSecretEnvelopeV1(envelope);
  } catch {
    return;
  }

  const adaptersByKind = new Map(
    layerAdapters.map((adapter) => [adapter.kind, adapter]),
  );
  await Promise.all(
    parsed.wrappingLayers.map(async (layer, layerIndex) => {
      const adapter = adaptersByKind.get(layer.kind);
      if (!adapter?.deleteLayerKey) {
        return;
      }
      try {
        await adapter.deleteLayerKey({
          dataType: parsed.dataType,
          layer,
          layerIndex,
          recordId: parsed.recordId,
        });
      } catch {
        // Best-effort cleanup for keys created by a failed outer DB CAS.
      }
    }),
  );
}

export class LocalSecretEnvelopeService {
  private credentialMigrationConfigCache:
    | ILocalSecretEnvelopeCredentialMigrationConfigCache
    | undefined;

  private credentialMigrationConfigCacheGeneration = 0;

  private credentialMigrationConfigPromise:
    | Promise<ILocalSecretEnvelopeCredentialMigrationConfig | undefined>
    | undefined;

  constructor(
    private readonly params: ILocalSecretEnvelopeServiceParams = {},
  ) {}

  getRuntimePlatform(): ILocalSecretEnvelopeRuntimePlatform {
    return (
      this.params.platform ??
      detectLocalSecretEnvelopeRuntimePlatform(this.params.platformEnv)
    );
  }

  buildLayerProviders(): ILocalSecretEnvelopeLayerProvider[] {
    const indexedDbCryptoKeyProvider = {
      buildLayerAdapter:
        this.params.buildIndexedDbCryptoKeyLayerAdapter ??
        buildIndexedDbCryptoKeyLocalSecretEnvelopeLayerAdapter,
      isAvailable:
        this.params.isIndexedDbCryptoKeyLayerAvailable ??
        isIndexedDbCryptoKeyLocalSecretEnvelopeLayerAvailable,
    };
    const secureStorageProvider = {
      buildLayerAdapter:
        this.params.buildSecureStorageLayerAdapter ??
        buildSecureStorageLocalSecretEnvelopeLayerAdapter,
      isAvailable:
        this.params.isSecureStorageLayerAvailable ??
        isSecureStorageLocalSecretEnvelopeLayerAvailable,
    };

    switch (this.getRuntimePlatform()) {
      case 'desktop':
        return [indexedDbCryptoKeyProvider, secureStorageProvider];
      case 'native':
        return [secureStorageProvider];
      case 'extension':
      case 'web':
        return [indexedDbCryptoKeyProvider];
      case 'unknown':
      default:
        return [indexedDbCryptoKeyProvider, secureStorageProvider];
    }
  }

  // Clear ONLY the cached credential-migration config (and bump the generation
  // so an in-flight probe cannot write a stale config back). Crucially this does
  // NOT reset the secureStorage capability-probe failure backoff: the read path
  // uses this to rebuild a degraded/stale config (e.g. to pick up a now-available
  // layer) while still respecting the probe's short failure TTL, so a genuine
  // keychain outage does not trigger a fresh (up to 5s) probe on every LSE read.
  clearCredentialMigrationConfigCache(): void {
    this.credentialMigrationConfigCacheGeneration += 1;
    this.credentialMigrationConfigCache = undefined;
    this.credentialMigrationConfigPromise = undefined;
  }

  clearCapabilityCache(): void {
    this.clearCredentialMigrationConfigCache();
    resetSecureStorageLocalSecretEnvelopeProbeCache();
  }

  private async buildCredentialMigrationConfigUncached(): Promise<
    ILocalSecretEnvelopeCredentialMigrationConfig | undefined
  > {
    const layerAdapters: ILocalSecretEnvelopeLayerAdapter[] = [];
    for (const provider of this.buildLayerProviders()) {
      if (await provider.isAvailable()) {
        layerAdapters.push(provider.buildLayerAdapter());
      }
    }

    if (!layerAdapters.length) {
      return undefined;
    }

    const strength: ILocalSecretEnvelopeStrength = layerAdapters.some(
      (adapter) => adapter.kind === 'secure-storage',
    )
      ? 'secure-storage-bound'
      : 'profile-bound';

    return {
      layerAdapters,
      runtimePlatform: this.getRuntimePlatform(),
      strength,
    };
  }

  async buildCredentialMigrationConfig(): Promise<
    ILocalSecretEnvelopeCredentialMigrationConfig | undefined
  > {
    if (this.credentialMigrationConfigCache) {
      return this.credentialMigrationConfigCache.value;
    }
    if (this.credentialMigrationConfigPromise) {
      return this.credentialMigrationConfigPromise;
    }

    const cacheGeneration = this.credentialMigrationConfigCacheGeneration;
    const promise = this.buildCredentialMigrationConfigUncached()
      .then((config) => {
        // Only cache a successfully-resolved config. A `undefined` result means
        // no layer was available right now (e.g. keychain busy / not yet first
        // unlocked at cold start). Permanently caching that would freeze a
        // transient capability-probe failure for the whole session and block
        // unwrapping every LSE-wrapped credential/verifyString until restart.
        // Leaving it uncached lets the next read re-probe.
        if (
          config &&
          this.credentialMigrationConfigCacheGeneration === cacheGeneration
        ) {
          this.credentialMigrationConfigCache = { value: config };
        }
        return config;
      })
      .finally(() => {
        if (this.credentialMigrationConfigPromise === promise) {
          this.credentialMigrationConfigPromise = undefined;
        }
      });
    this.credentialMigrationConfigPromise = promise;
    return promise;
  }

  async buildLayerAdapterResolver(): Promise<
    ILocalSecretEnvelopeLayerAdapterResolver | undefined
  > {
    const config = await this.buildCredentialMigrationConfig();
    return buildLocalSecretEnvelopeLayerAdapterResolver(
      config?.layerAdapters ?? [],
    );
  }
}

export const localSecretEnvelopeService = new LocalSecretEnvelopeService();
