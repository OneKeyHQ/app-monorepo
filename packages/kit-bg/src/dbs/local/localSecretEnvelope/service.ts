import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IPlatformEnv } from '@onekeyhq/shared/src/platformEnv';

import {
  buildIndexedDbCryptoKeyLocalSecretEnvelopeLayerAdapter,
  isIndexedDbCryptoKeyLocalSecretEnvelopeLayerAvailable,
} from './indexedDbCryptoKeyLayerAdapter';
import {
  buildMmkvProfileKeyLocalSecretEnvelopeLayerAdapter,
  isMmkvProfileKeyLocalSecretEnvelopeLayerAvailable,
} from './mmkvProfileKeyLayerAdapter';
import { parseLocalSecretEnvelopeV1 } from './parser';
import {
  buildSecureStorageLocalSecretEnvelopeLayerAdapter,
  getSecureStorageLocalSecretEnvelopeLayerAvailability,
  resetSecureStorageLocalSecretEnvelopeProbeCache,
} from './secureStorageLayerAdapter';

import type {
  ILocalSecretEnvelopeLayerAdapter,
  ILocalSecretEnvelopeLayerAdapterResolver,
  ILocalSecretEnvelopeLayerAvailability,
  ILocalSecretEnvelopeLayerKind,
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
  getAvailability: () => Promise<ILocalSecretEnvelopeLayerAvailability>;
  kind: ILocalSecretEnvelopeLayerKind;
};

type ILocalSecretEnvelopeLayerProviderComposition = {
  base: ILocalSecretEnvelopeLayerProvider;
  enhancements: ILocalSecretEnvelopeLayerProvider[];
};

type ILocalSecretEnvelopeServiceParams = {
  buildIndexedDbCryptoKeyLayerAdapter?: () => ILocalSecretEnvelopeLayerAdapter;
  buildMmkvProfileKeyLayerAdapter?: () => ILocalSecretEnvelopeLayerAdapter;
  buildSecureStorageLayerAdapter?: () => ILocalSecretEnvelopeLayerAdapter;
  getSecureStorageLayerAvailability?: () => Promise<ILocalSecretEnvelopeLayerAvailability>;
  isIndexedDbCryptoKeyLayerAvailable?: () => Promise<boolean>;
  isMmkvProfileKeyLayerAvailable?: () => Promise<boolean>;
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

type ILocalSecretEnvelopeCredentialMigrationConfigBuildResult = {
  cacheable: boolean;
  value: ILocalSecretEnvelopeCredentialMigrationConfig | undefined;
};

async function getBaseLayerAvailability(
  isAvailable: () => Promise<boolean>,
): Promise<ILocalSecretEnvelopeLayerAvailability> {
  try {
    return (await isAvailable()) ? 'available' : 'temporarily-unavailable';
  } catch {
    return 'temporarily-unavailable';
  }
}

async function getOptionalLayerAvailability(
  isAvailable: () => Promise<boolean>,
): Promise<ILocalSecretEnvelopeLayerAvailability> {
  try {
    return (await isAvailable()) ? 'available' : 'unsupported';
  } catch {
    return 'temporarily-unavailable';
  }
}

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
    | Promise<ILocalSecretEnvelopeCredentialMigrationConfigBuildResult>
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

  buildLayerProviders(): ILocalSecretEnvelopeLayerProviderComposition {
    const indexedDbCryptoKeyProvider = {
      buildLayerAdapter:
        this.params.buildIndexedDbCryptoKeyLayerAdapter ??
        buildIndexedDbCryptoKeyLocalSecretEnvelopeLayerAdapter,
      getAvailability: () =>
        getBaseLayerAvailability(
          this.params.isIndexedDbCryptoKeyLayerAvailable ??
            isIndexedDbCryptoKeyLocalSecretEnvelopeLayerAvailable,
        ),
      kind: 'indexeddb-cryptokey' as const,
    };
    const mmkvProfileKeyProvider = {
      buildLayerAdapter:
        this.params.buildMmkvProfileKeyLayerAdapter ??
        buildMmkvProfileKeyLocalSecretEnvelopeLayerAdapter,
      getAvailability: () =>
        getBaseLayerAvailability(
          this.params.isMmkvProfileKeyLayerAvailable ??
            isMmkvProfileKeyLocalSecretEnvelopeLayerAvailable,
        ),
      kind: 'mmkv-profile-key' as const,
    };
    const secureStorageProvider = {
      buildLayerAdapter:
        this.params.buildSecureStorageLayerAdapter ??
        buildSecureStorageLocalSecretEnvelopeLayerAdapter,
      getAvailability: this.params.getSecureStorageLayerAvailability
        ? this.params.getSecureStorageLayerAvailability
        : () =>
            this.params.isSecureStorageLayerAvailable
              ? getOptionalLayerAvailability(
                  this.params.isSecureStorageLayerAvailable,
                )
              : getSecureStorageLocalSecretEnvelopeLayerAvailability(),
      kind: 'secure-storage' as const,
    };

    switch (this.getRuntimePlatform()) {
      case 'desktop':
        return {
          base: indexedDbCryptoKeyProvider,
          enhancements: [secureStorageProvider],
        };
      case 'native':
        return {
          base: mmkvProfileKeyProvider,
          enhancements: [secureStorageProvider],
        };
      case 'extension':
      case 'web':
        return {
          base: indexedDbCryptoKeyProvider,
          enhancements: [secureStorageProvider],
        };
      case 'unknown':
      default:
        return {
          base: indexedDbCryptoKeyProvider,
          enhancements: [secureStorageProvider],
        };
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

  private async buildCredentialMigrationConfigUncached(): Promise<ILocalSecretEnvelopeCredentialMigrationConfigBuildResult> {
    const providers = this.buildLayerProviders();
    const baseAvailability = await providers.base.getAvailability();
    if (baseAvailability !== 'available') {
      return { cacheable: false, value: undefined };
    }

    const layerAdapters: ILocalSecretEnvelopeLayerAdapter[] = [
      providers.base.buildLayerAdapter(),
    ];
    let cacheable = true;
    for (const provider of providers.enhancements) {
      let availability: ILocalSecretEnvelopeLayerAvailability;
      try {
        availability = await provider.getAvailability();
      } catch {
        availability = 'temporarily-unavailable';
      }
      if (availability === 'available') {
        layerAdapters.push(provider.buildLayerAdapter());
      } else if (availability === 'temporarily-unavailable') {
        cacheable = false;
      }
    }

    const strength: ILocalSecretEnvelopeStrength = layerAdapters.some(
      (adapter) => adapter.kind === 'secure-storage',
    )
      ? 'secure-storage-bound'
      : 'profile-bound';

    return {
      cacheable,
      value: {
        layerAdapters,
        runtimePlatform: this.getRuntimePlatform(),
        strength,
      },
    };
  }

  async buildCredentialMigrationConfig(): Promise<
    ILocalSecretEnvelopeCredentialMigrationConfig | undefined
  > {
    if (this.credentialMigrationConfigCache) {
      return this.credentialMigrationConfigCache.value;
    }
    if (this.credentialMigrationConfigPromise) {
      return (await this.credentialMigrationConfigPromise).value;
    }

    const cacheGeneration = this.credentialMigrationConfigCacheGeneration;
    const promise = this.buildCredentialMigrationConfigUncached()
      .then((result) => {
        // A base-layer outage, or a temporarily unavailable enhancement, must
        // not freeze a degraded topology for the whole session. The provider's
        // short failure TTL prevents probe storms while a later write can still
        // upgrade back to the full layer set after recovery.
        if (
          result.value &&
          result.cacheable &&
          this.credentialMigrationConfigCacheGeneration === cacheGeneration
        ) {
          this.credentialMigrationConfigCache = { value: result.value };
        }
        return result;
      })
      .finally(() => {
        if (this.credentialMigrationConfigPromise === promise) {
          this.credentialMigrationConfigPromise = undefined;
        }
      });
    this.credentialMigrationConfigPromise = promise;
    return (await promise).value;
  }

  async buildLayerAdapterResolver(): Promise<
    ILocalSecretEnvelopeLayerAdapterResolver | undefined
  > {
    const config = await this.buildCredentialMigrationConfig();
    return buildLocalSecretEnvelopeLayerAdapterResolver(
      config?.layerAdapters ?? [],
    );
  }

  async buildRequiredLayerAdapterResolver({
    requiredLayerKinds,
  }: {
    requiredLayerKinds: ILocalSecretEnvelopeLayerKind[];
  }): Promise<ILocalSecretEnvelopeLayerAdapterResolver | undefined> {
    const providers = this.buildLayerProviders();
    const providersByKind = new Map(
      [providers.base, ...providers.enhancements].map((provider) => [
        provider.kind,
        provider,
      ]),
    );
    const layerAdapters: ILocalSecretEnvelopeLayerAdapter[] = [];

    for (const kind of new Set(requiredLayerKinds)) {
      const provider = providersByKind.get(kind);
      if (!provider) {
        return undefined;
      }
      let availability: ILocalSecretEnvelopeLayerAvailability;
      try {
        availability = await provider.getAvailability();
      } catch {
        availability = 'temporarily-unavailable';
      }
      if (availability !== 'available') {
        return undefined;
      }
      layerAdapters.push(provider.buildLayerAdapter());
    }

    return buildLocalSecretEnvelopeLayerAdapterResolver(layerAdapters);
  }
}

export const localSecretEnvelopeService = new LocalSecretEnvelopeService();
