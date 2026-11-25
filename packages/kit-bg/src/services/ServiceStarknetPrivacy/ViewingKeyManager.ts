import { normalizeStarknetChainId } from '@onekeyhq/core/src/chains/starknet/sdkStarknet/chainId';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { strk20Error } from '@onekeyhq/shared/src/utils/strk20ErrorUtils';
import { EStrk20ErrorCode } from '@onekeyhq/shared/types/starknetPrivacy';

import simpleDb from '../../dbs/simple/simpleDb';
import { getViewingKeyFingerprint } from '../../vaults/localWallet/viewingKeyFingerprint';
import {
  getDecryptedLocalWalletViewingKey,
  saveEncryptedLocalWalletViewingKey,
} from '../../vaults/localWallet/viewingKeyStore';

import { buildPrivacyCacheKey, buildPrivacyKeyScope } from './types';

import type {
  IStarknetPrivacyCredentials,
  IStarknetPrivacyScope,
  IStarknetVaultResolver,
  IViewingKeyCacheEntry,
} from './types';
import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IKeyringStrk20ViewingKeyDeriver } from '../../vaults/impls/starknet/privacyKeyringTypes';

type IViewingKeyManagerDeps = {
  backgroundApi: IBackgroundApi;
  getStarknetVault: IStarknetVaultResolver;
  isDisabledByServer: (networkId: string) => Promise<boolean>;
  onClearAll?: () => void;
  onDropScope?: (scopeKey: string) => void;
};

/**
 * Background-only owner of STRK20 viewing-key secrets:
 * - in-memory cache + concurrent derivation deduplication
 * - encrypted persistence via `viewingKeyStore` (AES-256-GCM under App password)
 * - generation counters that invalidate in-flight operations on lock/removal/opt-out
 */
export class ViewingKeyManager {
  private readonly deps: IViewingKeyManagerDeps;

  private readonly viewingKeyCache = new Map<string, IViewingKeyCacheEntry>();

  private readonly viewingKeyDerivations = new Map<
    string,
    Promise<IViewingKeyCacheEntry>
  >();

  private viewingKeyGeneration = 0;

  private readonly keyGenerations = new Map<string, number>();

  private authorizationGeneration = 0;

  constructor(deps: IViewingKeyManagerDeps) {
    this.deps = deps;
  }

  getGeneration(): number {
    return this.viewingKeyGeneration;
  }

  getAuthorizationGeneration(): number {
    return this.authorizationGeneration;
  }

  getKeyGeneration(scopeKey: string): number {
    return this.keyGenerations.get(scopeKey) ?? 0;
  }

  isKeyLoaded(p: IStarknetPrivacyScope): boolean {
    return this.viewingKeyCache.has(buildPrivacyCacheKey(p));
  }

  clear(): void {
    this.viewingKeyGeneration += 1;
    this.keyGenerations.clear();
    this.viewingKeyDerivations.clear();
    this.viewingKeyCache.clear();
    this.deps.onClearAll?.();
  }

  // Password expiry invalidates in-flight authorizations. Read-only keys
  // already derived for this unlocked session remain usable until lock.
  invalidatePendingAuthorizations(): void {
    this.authorizationGeneration += 1;
  }

  dropScope(p: IStarknetPrivacyScope): void {
    const key = buildPrivacyCacheKey(p);
    this.keyGenerations.set(key, this.getKeyGeneration(key) + 1);
    this.viewingKeyDerivations.delete(key);
    this.viewingKeyCache.delete(key);
    void this.removePersistedViewingKey(p);
    this.deps.onDropScope?.(key);
  }

  private async hasPersistedEncryptedViewingKey(
    p: IStarknetPrivacyScope,
  ): Promise<boolean> {
    if (!simpleDb.privacyChainKeys?.getKey) {
      return false;
    }
    const scope = buildPrivacyKeyScope(p);
    const record = await simpleDb.privacyChainKeys
      .getKey({
        accountId: p.accountId,
        scope,
      })
      .catch(() => undefined);
    return (
      record?.networkId === p.networkId && record.sealed.format === 'encrypted'
    );
  }

  private async loadPersistedViewingKey(
    p: IStarknetPrivacyScope & { password: string },
  ): Promise<IViewingKeyCacheEntry | undefined> {
    if (!p.password || !simpleDb.privacyChainKeys?.getKey) {
      return undefined;
    }
    const scope = buildPrivacyKeyScope(p);
    try {
      const decrypted = await getDecryptedLocalWalletViewingKey({
        backgroundApi: this.deps.backgroundApi,
        accountId: p.accountId,
        scope,
        networkId: p.networkId,
        password: p.password,
      });
      if (!decrypted) {
        return undefined;
      }
      const parsed = JSON.parse(
        decrypted.value,
      ) as Partial<IViewingKeyCacheEntry>;
      if (
        typeof parsed.viewingKey !== 'string' ||
        typeof parsed.publicKeyX !== 'string' ||
        !parsed.viewingKey ||
        !parsed.publicKeyX
      ) {
        await this.removePersistedViewingKey(p);
        return undefined;
      }
      if (
        getViewingKeyFingerprint({
          networkId: p.networkId,
          viewingKey: parsed.viewingKey,
        }) !== decrypted.vkFp
      ) {
        await this.removePersistedViewingKey(p);
        return undefined;
      }
      return {
        viewingKey: parsed.viewingKey,
        publicKeyX: parsed.publicKeyX,
      };
    } catch {
      await this.removePersistedViewingKey(p);
      return undefined;
    }
  }

  private async persistEncryptedViewingKey(
    p: IStarknetPrivacyScope & {
      entry: IViewingKeyCacheEntry;
      password: string;
    },
  ): Promise<void> {
    if (!p.password || !simpleDb.privacyChainKeys?.saveKey) {
      return;
    }
    const scope = buildPrivacyKeyScope(p);
    const vkFp = getViewingKeyFingerprint({
      networkId: p.networkId,
      viewingKey: p.entry.viewingKey,
    });
    await saveEncryptedLocalWalletViewingKey({
      backgroundApi: this.deps.backgroundApi,
      accountId: p.accountId,
      scope,
      networkId: p.networkId,
      vkFp,
      plaintext: JSON.stringify(p.entry),
      password: p.password,
    }).catch(() => undefined);
  }

  private async removePersistedViewingKey(
    p: IStarknetPrivacyScope,
  ): Promise<void> {
    if (!simpleDb.privacyChainKeys?.removeKey) {
      return;
    }
    const scope = buildPrivacyKeyScope(p);
    await simpleDb.privacyChainKeys
      .removeKey({
        accountId: p.accountId,
        scope,
      })
      .catch(() => undefined);
  }

  /**
   * Prepare registered accounts while the verified password is available,
   * restoring encrypted viewing keys for both software and hardware accounts
   * and deriving unpersisted software accounts locally.
   */
  async prepareUnlockedViewingKeys(): Promise<void> {
    const generation = this.viewingKeyGeneration;
    const records = await simpleDb.starknetPrivacy.getRegisteredAccounts();
    const eligibleAccounts = records.filter(
      ({ accountId }) =>
        accountUtils.isHdAccount({ accountId }) ||
        accountUtils.isImportedAccount({ accountId }) ||
        accountUtils.isHwAccount({ accountId }),
    );
    if (!eligibleAccounts.length || generation !== this.viewingKeyGeneration) {
      return;
    }
    const password =
      await this.deps.backgroundApi.servicePassword?.getCachedPasswordForBackgroundRead?.();
    if (!password || generation !== this.viewingKeyGeneration) return;
    const { STRK20_PRIVACY_CONFIG } =
      await import('../../vaults/impls/starknet/sdkStarknet/consts');
    const accounts = eligibleAccounts.filter(
      ({ networkId, poolAddress }) =>
        STRK20_PRIVACY_CONFIG[networkId]?.poolAddress.toLowerCase() ===
        poolAddress.toLowerCase(),
    );
    for (const { accountId, networkId, poolAddress } of accounts) {
      if (generation !== this.viewingKeyGeneration) return;
      const cacheKey = buildPrivacyCacheKey({
        networkId,
        accountId,
        poolAddress,
      });
      if (!this.viewingKeyCache.has(cacheKey)) {
        // eslint-disable-next-line no-await-in-loop
        const persisted = await this.loadPersistedViewingKey({
          networkId,
          accountId,
          poolAddress,
          password,
        });
        if (persisted) {
          if (generation !== this.viewingKeyGeneration) return;
          this.viewingKeyCache.set(cacheKey, persisted);
        } else if (!accountUtils.isHwAccount({ accountId })) {
          // Derive locally, one account at a time. A removed account cannot prevent
          // another registered account from using its unlock session.
          // eslint-disable-next-line no-await-in-loop
          await this.ensureViewingKey({
            accountId,
            networkId,
            poolAddress,
            skipPersistedLookup: true,
            resolveCredentials: async () => {
              if (await this.deps.isDisabledByServer(networkId)) {
                throw strk20Error(EStrk20ErrorCode.Unavailable);
              }
              if (generation !== this.viewingKeyGeneration) {
                throw strk20Error(EStrk20ErrorCode.Locked);
              }
              return { password };
            },
          }).catch(() => undefined);
        }
      }
    }
  }

  /**
   * Viewing keys are scoped to this manager. The caller supplies credentials
   * according to whether the operation can interact with the user.
   */
  async ensureViewingKey(
    p: IStarknetPrivacyScope & {
      skipPersistedLookup?: boolean;
      resolveCredentials: () => Promise<IStarknetPrivacyCredentials>;
    },
  ): Promise<IViewingKeyCacheEntry> {
    const generation = this.viewingKeyGeneration;
    const key = buildPrivacyCacheKey(p);
    const keyGeneration = this.getKeyGeneration(key);
    const isSessionValid = () =>
      generation === this.viewingKeyGeneration &&
      keyGeneration === this.getKeyGeneration(key);
    const cached =
      this.viewingKeyCache.get(key) ?? this.viewingKeyDerivations.get(key);
    if (cached) {
      return cached;
    }
    if (accountUtils.isWatchingOrExternalAccount({ accountId: p.accountId })) {
      throw strk20Error(EStrk20ErrorCode.Unavailable);
    }

    if (
      !p.skipPersistedLookup &&
      (await this.hasPersistedEncryptedViewingKey(p))
    ) {
      const backgroundPassword =
        await this.deps.backgroundApi.servicePassword?.getCachedPasswordForBackgroundRead?.();
      if (backgroundPassword && isSessionValid()) {
        const persisted = await this.loadPersistedViewingKey({
          networkId: p.networkId,
          accountId: p.accountId,
          poolAddress: p.poolAddress,
          password: backgroundPassword,
        });
        if (persisted && isSessionValid()) {
          this.viewingKeyCache.set(key, persisted);
          return persisted;
        }
      }
    }

    const credentials = await p.resolveCredentials();

    if (!isSessionValid()) throw strk20Error(EStrk20ErrorCode.Locked);
    const ready = this.viewingKeyCache.get(key);
    if (ready) return ready;

    const deriveViewingKey = async (): Promise<IViewingKeyCacheEntry> => {
      const vault = await this.deps.getStarknetVault(p);
      const keyring =
        vault.keyring as unknown as IKeyringStrk20ViewingKeyDeriver;
      const [account, network] = await Promise.all([
        vault.getAccount(),
        vault.getNetwork(),
      ]);
      const derive = () =>
        keyring.deriveStrk20ViewingKey({
          password: credentials.password,
          ...(credentials.deviceParams
            ? { deviceParams: credentials.deviceParams }
            : {}),
          chainId: normalizeStarknetChainId(network.chainId),
          accountAddress: account.address,
          poolAddress: p.poolAddress,
        });
      const derived = credentials.deviceParams
        ? await this.deps.backgroundApi.serviceHardwareUI.withHardwareProcessing(
            derive,
            {
              deviceParams: credentials.deviceParams,
              debugMethodName: 'starknetPrivacy.deriveViewingKey',
            },
          )
        : await derive();

      const entry: IViewingKeyCacheEntry = {
        viewingKey: derived.viewingKey,
        publicKeyX: derived.publicKeyX,
      };
      if (!isSessionValid()) {
        throw strk20Error(EStrk20ErrorCode.Locked);
      }
      this.viewingKeyCache.set(key, entry);
      const sealPassword =
        credentials.password ||
        (await this.deps.backgroundApi.servicePassword?.getCachedPasswordForBackgroundRead?.());
      if (sealPassword) {
        void this.persistEncryptedViewingKey({
          networkId: p.networkId,
          accountId: p.accountId,
          poolAddress: p.poolAddress,
          entry,
          password: sealPassword,
        });
      }
      return entry;
    };

    if (credentials.deviceParams) return deriveViewingKey();
    const pending = this.viewingKeyDerivations.get(key);
    if (pending) return pending;
    const request = deriveViewingKey();
    this.viewingKeyDerivations.set(key, request);
    try {
      return await request;
    } finally {
      if (this.viewingKeyDerivations.get(key) === request) {
        this.viewingKeyDerivations.delete(key);
      }
    }
  }
}
