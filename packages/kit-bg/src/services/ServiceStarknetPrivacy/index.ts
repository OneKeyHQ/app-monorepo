import BigNumber from 'bignumber.js';

import { normalizeStarknetChainId } from '@onekeyhq/core/src/chains/starknet/sdkStarknet/chainId';
import type { IDecodedTxExtraStarknet } from '@onekeyhq/core/src/chains/starknet/types';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  scaleFeeFiatValueToNativeFee,
  sortHistoryTxsByTime,
} from '@onekeyhq/shared/src/utils/historyUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import { projectPrivacyChainHistoryTxToPool } from '@onekeyhq/shared/src/utils/privacyChainHistoryUtils';
import { strk20Error } from '@onekeyhq/shared/src/utils/strk20ErrorUtils';
import type { IDeviceSharedCallParams } from '@onekeyhq/shared/types/device';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import type { IProxyRequest } from '@onekeyhq/shared/types/proxy';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';
import {
  EStrk20ErrorCode,
  EStrk20OptInStatus,
  type EStrk20PrivateTxKind,
  EStrk20SequencingStatus,
  type IStrk20AccountKey,
  type IStrk20AccountPrivacyState,
  type IStrk20HistoryCursor,
  type IStrk20PrivacyNetworkConfig,
  type IStrk20PrivateBalances,
  type IStrk20SequencingState,
  type IStrk20TransferKind,
  type IStrk20Warning,
} from '@onekeyhq/shared/types/starknetPrivacy';
import type { IToken } from '@onekeyhq/shared/types/token';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import simpleDb from '../../dbs/simple/simpleDb';
import { getViewingKeyFingerprint } from '../../vaults/localWallet/viewingKeyFingerprint';
import {
  getDecryptedLocalWalletViewingKey,
  saveEncryptedLocalWalletViewingKey,
} from '../../vaults/localWallet/viewingKeyStore';
import ServiceBase from '../ServiceBase';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type {
  IKeyringStrk20ProofInvocationSigner,
  IKeyringStrk20ViewingKeyDeriver,
} from '../../vaults/impls/starknet/privacyKeyringTypes';
import type ClientStarknet from '../../vaults/impls/starknet/sdkStarknet/ClientStarknet';
import type {
  IStrk20InternalHistoryCursor,
  IStrk20ProverProxyItem,
} from '../../vaults/impls/starknet/strk20Adapter';
import type StarknetVault from '../../vaults/impls/starknet/Vault';
import type { IVaultSettingsPrivacyPool } from '../../vaults/types';

const PRIVATE_BALANCE_REFRESH_INTERVAL_MS = 60_000;
type IViewingKeyCacheEntry = {
  viewingKey: string;
  publicKeyX: string;
};

type IPrivateBalanceQuery = IStrk20AccountKey & { tokenAddresses?: string[] };
type IPrivateBalanceSnapshot = IStrk20PrivateBalances & {
  lastSyncedAt: number;
};

const MAX_HISTORY_CURSORS = 32;

type IStoredHistoryCursor = IStrk20InternalHistoryCursor & {
  scopeKey: string;
  generation: number;
  keyGeneration: number;
};

/**
 * STRK20 private transfers on Starknet.
 *
 * bg-only by construction: the viewing key is derived here, cached here and
 * never returned from a `@backgroundMethod()`. The service never signs and
 * never broadcasts — signing stays in the keyring, submission in the vault.
 */
@backgroundClass()
class ServiceStarknetPrivacy extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: IBackgroundApi }) {
    super({ backgroundApi });
    // The viewing key is a derived secret, so it must not outlive the account
    // it belongs to. Persisted records are swept separately by
    // ServiceAppCleanup, which knows which accounts survived.
    appEventBus.on(EAppEventBusNames.AccountRemove, () => {
      void this.clearViewingKeyCache();
    });
    appEventBus.on(EAppEventBusNames.WalletRemove, () => {
      void this.clearViewingKeyCache();
    });
  }

  private viewingKeyCache = new Map<string, IViewingKeyCacheEntry>();
  private readonly viewingKeyDerivations = new Map<
    string,
    Promise<IViewingKeyCacheEntry>
  >();
  private viewingKeyGeneration = 0;
  private readonly keyGenerations = new Map<string, number>();
  private authorizationGeneration = 0;

  // Display snapshots share the viewing session's cleanup and stay in memory.
  private privateBalances = new Map<string, IPrivateBalanceSnapshot>();

  private privateBalanceRequests = new Map<
    string,
    Promise<IPrivateBalanceSnapshot>
  >();

  // Bg-only history cursors keyed by opaque cursorId so channelKeys never cross IPC.
  private readonly historyCursors = new Map<string, IStoredHistoryCursor>();

  // Serializes privacy tx submission per (networkId, accountId) to close the
  // TOCTOU window between assertPrivacyTxCanSubmit and note*Submitted.
  private readonly privacyTxSubmitInFlight = new Set<string>();

  // ---------------------------------------------------------------- config

  @backgroundMethod()
  async getPrivacyConfig(p: {
    networkId: string;
  }): Promise<IStrk20PrivacyNetworkConfig | undefined> {
    const { STRK20_PRIVACY_CONFIG } =
      await import('../../vaults/impls/starknet/sdkStarknet/consts');
    return STRK20_PRIVACY_CONFIG[p.networkId];
  }

  /**
   * The server's switch, shared with Zcash and Monero: `privacyDisabled` in the
   * network list's `extensions.localWallet`. Off blocks the feature and keeps
   * every local record.
   */
  private async isDisabledByServer(networkId: string): Promise<boolean> {
    await this.backgroundApi.serviceCustomRpc.ensureLocalWalletRemoteConfigLoaded();
    const { isLocalWalletPrivacyDisabled } =
      await import('../../vaults/localWallet/remoteConfig');
    return isLocalWalletPrivacyDisabled(networkId);
  }

  /** The backend adds the Starkscan key on this route; it must not log the body. */
  private async postStrk20ProverProxy(
    request: IProxyRequest,
    signal?: AbortSignal,
  ): Promise<IStrk20ProverProxyItem | undefined> {
    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    // The wallet proxy validates this HTTP header before forwarding the job.
    const idempotencyKey = request.body[0]?.params.headers?.['Idempotency-Key'];
    const resp = await client.post<{
      data: { data: IStrk20ProverProxyItem[] };
    }>('/wallet/v1/proxy/wallet', request, {
      signal,
      ...(idempotencyKey
        ? { headers: { 'Idempotency-Key': idempotencyKey } }
        : {}),
    });
    return resp.data.data.data[0];
  }

  private async getPrivacyPoolSettings(
    networkId: string,
  ): Promise<IVaultSettingsPrivacyPool | undefined> {
    const settings = await this.backgroundApi.serviceNetwork.getVaultSettings({
      networkId,
    });
    return settings.privacyPool;
  }

  /**
   * `accountId` is optional so the UI can ask a plain network question. With it,
   * the account-level gates apply too: a watching account holds no key, and first-use deployment is handled before proof authorization.
   */
  @backgroundMethod()
  async isPrivacyAvailable(p: {
    networkId: string;
    accountId?: string;
  }): Promise<boolean> {
    const poolSettings = await this.getPrivacyPoolSettings(p.networkId);
    if (!poolSettings) {
      return false;
    }
    const config = await this.getPrivacyConfig({ networkId: p.networkId });
    if (!config) {
      return false;
    }
    if (await this.isDisabledByServer(p.networkId)) {
      return false;
    }
    if (
      p.accountId &&
      accountUtils.isWatchingOrExternalAccount({ accountId: p.accountId })
    ) {
      return false;
    }

    const vault = await this.getStarknetVault({
      networkId: p.networkId,
      accountId: p.accountId,
    });
    const client = await vault.getClient();
    return this.supportsPrivacyRpc(client, config);
  }

  private async supportsPrivacyRpc(
    client: ClientStarknet,
    config: IStrk20PrivacyNetworkConfig,
  ) {
    const { isSpecVersionAtLeast } =
      await import('../../vaults/impls/starknet/strk20Protocol');
    return isSpecVersionAtLeast(
      await client.getSpecVersion(),
      config.minRpcSpecVersion,
    );
  }

  @backgroundMethod()
  async prepareAccountActivation(
    p: IStrk20AccountKey,
  ): Promise<IUnsignedTxPro | undefined> {
    if (!(await this.isPrivacyAvailable(p)))
      throw strk20Error(EStrk20ErrorCode.Unavailable);
    const sequencing = await this.getSequencingState(p);
    if (sequencing.status === EStrk20SequencingStatus.Waiting)
      throw strk20Error(EStrk20ErrorCode.Waiting);
    return (await this.getStarknetVault(p)).buildAccountActivationTx();
  }

  @backgroundMethod()
  async noteAccountActivationSubmitted(
    p: IStrk20AccountKey & { txid: string },
  ): Promise<void> {
    const poolAddress = await this.resolvePoolAddress(p.networkId);
    await simpleDb.starknetPrivacy.patchRecord({
      ...p,
      poolAddress,
      patch: { activationTxid: p.txid },
    });
  }

  /**
   * The pool's per-operation fee in STRK, read from chain: the protocol changes
   * it (6 STRK in 2026-09, 2.5 STRK on 2026-10-21), so no config can pin it.
   */
  @backgroundMethod()
  async getProtocolFee(p: { networkId: string }): Promise<string> {
    const [poolAddress, vault] = await Promise.all([
      this.resolvePoolAddress(p.networkId),
      this.getStarknetVault({ networkId: p.networkId }),
    ]);
    const [client, network] = await Promise.all([
      vault.getClient(),
      vault.getNetwork(),
    ]);
    const fee = await client.getPoolFeeAmount(poolAddress);
    return new BigNumber(fee).shiftedBy(-network.feeMeta.decimals).toFixed();
  }

  private async getStarknetVault(p: {
    networkId: string;
    accountId?: string;
  }): Promise<StarknetVault> {
    // a network-level read has no account, and getVault cannot resolve one
    const { vaultFactory } = await import('../../vaults/factory');
    const vault = p.accountId
      ? await vaultFactory.getVault({
          networkId: p.networkId,
          accountId: p.accountId,
        })
      : await vaultFactory.getChainOnlyVault({ networkId: p.networkId });
    return vault as StarknetVault;
  }

  // ------------------------------------------------------------ opt-in state

  private async resolvePoolAddress(networkId: string): Promise<string> {
    const config = await this.getPrivacyConfig({ networkId });
    if (!config?.poolAddress) {
      throw strk20Error(EStrk20ErrorCode.Unavailable);
    }
    return config.poolAddress;
  }

  @backgroundMethod()
  async getAccountPrivacyState(
    p: IStrk20AccountKey,
  ): Promise<IStrk20AccountPrivacyState> {
    const poolAddress = await this.resolvePoolAddress(p.networkId);
    const stored = await simpleDb.starknetPrivacy.getRecord({
      networkId: p.networkId,
      accountId: p.accountId,
      poolAddress,
    });
    if (stored?.optInStatus === EStrk20OptInStatus.RegisterPending) {
      return this.reconcileRegisterPending({
        ...p,
        poolAddress,
        record: stored,
      });
    }
    if (stored) {
      return this.reconcileTransfer({ ...p, poolAddress, record: stored });
    }
    return this.buildEmptyState({ ...p, poolAddress });
  }

  /** Called by the vault once the node accepted a register tx. */
  async noteRegisterSubmitted(
    p: IStrk20AccountKey & { poolAddress: string; txid: string },
  ): Promise<void> {
    await simpleDb.starknetPrivacy.patchRecord({
      networkId: p.networkId,
      accountId: p.accountId,
      poolAddress: p.poolAddress,
      expected: { optInStatus: EStrk20OptInStatus.Consented },
      patch: {
        optInStatus: EStrk20OptInStatus.RegisterPending,
        registerTxid: p.txid,
        registerSubmittedAt: Date.now(),
        registerTxFailed: false,
      },
    });
  }

  /**
   * Settles registerPending from the register tx's receipt, so the outcome
   * lands even if the app was closed before it confirmed. Only a failed
   * receipt permits a retry; a missing receipt is an unknown outcome.
   */
  private async reconcileRegisterPending(p: {
    networkId: string;
    accountId: string;
    poolAddress: string;
    record: IStrk20AccountPrivacyState;
  }): Promise<IStrk20AccountPrivacyState> {
    const { record } = p;
    try {
      const vault = await this.getStarknetVault(p);
      const client = await vault.getClient();
      const receipt = record.registerTxid
        ? await client.getTransactionReceipt(record.registerTxid)
        : null;
      const { getReceiptTxStatus } =
        await import('../../vaults/impls/starknet/utils');
      const status = getReceiptTxStatus(receipt);

      let patch: Partial<IStrk20AccountPrivacyState> | undefined;
      if (status === EOnChainHistoryTxStatus.Success) {
        // The register landed, so the pool now holds this device's key.
        const registeredPublicKey = await client.getPoolRegisteredPublicKey({
          poolAddress: p.poolAddress,
          accountAddress: record.accountAddress,
        });
        if (!registeredPublicKey) return record;
        patch = {
          optInStatus: EStrk20OptInStatus.Registered,
          registeredPublicKey,
          registerTxFailed: false,
          ...(typeof receipt?.block_number === 'number'
            ? { lastTxBlockNumber: receipt.block_number }
            : {}),
        };
      } else if (status === EOnChainHistoryTxStatus.Failed) {
        patch = {
          optInStatus: EStrk20OptInStatus.Consented,
          registerTxFailed: true,
          ...(typeof receipt?.block_number === 'number'
            ? { lastTxBlockNumber: receipt.block_number }
            : {}),
        };
      }
      if (!patch) {
        return record;
      }
      const updated = await simpleDb.starknetPrivacy.patchRecord({
        networkId: p.networkId,
        accountId: p.accountId,
        poolAddress: p.poolAddress,
        patch,
        expected: {
          optInStatus: EStrk20OptInStatus.RegisterPending,
          registerTxid: record.registerTxid,
        },
      });
      return updated ?? record;
    } catch {
      // A failed check leaves the record pending; the next read retries.
      return record;
    }
  }

  async notePrivateTransferSubmitted(
    p: IStrk20AccountKey & {
      poolAddress: string;
      txid: string;
      kind: IStrk20TransferKind;
    },
  ): Promise<void> {
    await simpleDb.starknetPrivacy.patchRecord({
      networkId: p.networkId,
      accountId: p.accountId,
      poolAddress: p.poolAddress,
      patch: {
        lastTransfer: {
          txid: p.txid,
          kind: p.kind,
          status: 'pending',
          submittedAt: Date.now(),
        },
      },
    });
  }

  async withPrivacyTxSubmitLock<T>(
    p: IStrk20AccountKey & { kind: EStrk20PrivateTxKind },
    fn: () => Promise<T>,
  ): Promise<T> {
    const lockKey = `${p.networkId}|${p.accountId}`;
    if (this.privacyTxSubmitInFlight.has(lockKey)) {
      throw strk20Error(EStrk20ErrorCode.Waiting);
    }
    this.privacyTxSubmitInFlight.add(lockKey);
    try {
      await this.assertPrivacyTxCanSubmit(p);
      return await fn();
    } finally {
      this.privacyTxSubmitInFlight.delete(lockKey);
    }
  }

  async assertPrivacyTxCanSubmit(
    p: IStrk20AccountKey & { kind: EStrk20PrivateTxKind },
  ): Promise<void> {
    if (await this.isDisabledByServer(p.networkId)) {
      throw strk20Error(EStrk20ErrorCode.Unavailable);
    }
    const state = await this.getAccountPrivacyState(p);
    if (
      state.optInStatus === EStrk20OptInStatus.RegisterPending ||
      state.lastTransfer?.status === 'pending'
    ) {
      throw strk20Error(EStrk20ErrorCode.Waiting);
    }
    const requiredStatus =
      p.kind === 'register'
        ? EStrk20OptInStatus.Consented
        : EStrk20OptInStatus.Registered;
    if (state.optInStatus !== requiredStatus) {
      throw strk20Error(EStrk20ErrorCode.Unavailable);
    }
  }

  private async reconcileTransfer(
    p: IStrk20AccountKey & {
      poolAddress: string;
      record: IStrk20AccountPrivacyState;
    },
  ): Promise<IStrk20AccountPrivacyState> {
    const transfer = p.record.lastTransfer;
    if (transfer?.status !== 'pending') return p.record;
    try {
      const client = await (await this.getStarknetVault(p)).getClient();
      const receipt = await client.getTransactionReceipt(transfer.txid);
      const { getReceiptTxStatus } =
        await import('../../vaults/impls/starknet/utils');
      const status = getReceiptTxStatus(receipt);
      if (
        status !== EOnChainHistoryTxStatus.Success &&
        status !== EOnChainHistoryTxStatus.Failed
      ) {
        return p.record;
      }
      const blockNumber = receipt?.block_number;
      return (
        (await simpleDb.starknetPrivacy.patchRecord({
          networkId: p.networkId,
          accountId: p.accountId,
          poolAddress: p.poolAddress,
          expected: { lastTransferTxid: transfer.txid },
          patch: {
            lastTransfer: {
              ...transfer,
              status:
                status === EOnChainHistoryTxStatus.Success
                  ? 'confirmed'
                  : 'failed',
            },
            ...(typeof blockNumber === 'number'
              ? {
                  lastTxBlockNumber: Math.max(
                    p.record.lastTxBlockNumber ?? 0,
                    blockNumber,
                  ),
                }
              : {}),
          },
        })) ?? p.record
      );
    } catch {
      // An unavailable receipt cannot authorize a second spend.
      return p.record;
    }
  }

  private async buildEmptyState(p: {
    networkId: string;
    accountId: string;
    poolAddress: string;
  }): Promise<IStrk20AccountPrivacyState> {
    const vault = await this.getStarknetVault(p);
    const [account, network] = await Promise.all([
      vault.getAccount(),
      vault.getNetwork(),
    ]);
    const registeredPublicKey = await vault
      .getClient()
      .then((client) =>
        client.getPoolRegisteredPublicKey({
          poolAddress: p.poolAddress,
          accountAddress: account.address,
        }),
      )
      .catch(() => undefined);
    return {
      profileId: 'account-leaf-v1',
      version: 1,
      networkId: p.networkId,
      accountId: p.accountId,
      chainId: normalizeStarknetChainId(network.chainId),
      accountAddress: account.address,
      poolAddress: p.poolAddress,
      keyIndex: 0,
      accountKeyScheme: 'stark-curve',
      accountKeyFingerprint: '',
      accountDerivationPath: account.path,
      registeredPublicKey,
      optInStatus: EStrk20OptInStatus.None,
    };
  }

  /**
   * Consent is recorded before the register transaction on purpose: a failed
   * register must not send the user through the consent dialog again.
   */
  @backgroundMethod()
  async recordConsent(
    p: IStrk20AccountKey & { consentAcceptedAt: number },
  ): Promise<void> {
    const poolAddress = await this.resolvePoolAddress(p.networkId);
    const current = await this.getAccountPrivacyState(p);
    if (
      current.optInStatus === EStrk20OptInStatus.RegisterPending ||
      current.optInStatus === EStrk20OptInStatus.Registered ||
      current.optInStatus === EStrk20OptInStatus.Mismatch
    )
      return;
    await simpleDb.starknetPrivacy.recordConsent({
      ...current,
      poolAddress,
      consentAcceptedAt: p.consentAcceptedAt,
    });
  }

  /**
   * Local only. The on-chain escrow of the viewing key is write-once and cannot
   * be revoked, so the registered public key is deliberately kept: re-opting in
   * must recognize the existing registration instead of writing a second one.
   */
  @backgroundMethod()
  async optOut(p: IStrk20AccountKey): Promise<void> {
    const poolAddress = await this.resolvePoolAddress(p.networkId);
    await simpleDb.starknetPrivacy.setOptInStatus({
      networkId: p.networkId,
      accountId: p.accountId,
      poolAddress,
      optInStatus: EStrk20OptInStatus.None,
    });
    this.dropCachedViewingKey({ ...p, poolAddress });
  }

  // ------------------------------------------------------- viewing key cache

  private buildCacheKey(p: {
    networkId: string;
    accountId: string;
    poolAddress: string;
  }): string {
    return [p.networkId, p.accountId, p.poolAddress.toLowerCase()].join('_');
  }

  private buildPrivacyKeyScope(p: {
    networkId: string;
    poolAddress: string;
  }): string {
    return `${p.networkId}:${p.poolAddress.toLowerCase()}`;
  }

  private async hasPersistedEncryptedViewingKey(p: {
    networkId: string;
    accountId: string;
    poolAddress: string;
  }): Promise<boolean> {
    if (!simpleDb.privacyChainKeys?.getKey) {
      return false;
    }
    const scope = this.buildPrivacyKeyScope(p);
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

  private async loadPersistedViewingKey(p: {
    networkId: string;
    accountId: string;
    poolAddress: string;
    password: string;
  }): Promise<IViewingKeyCacheEntry | undefined> {
    if (!p.password || !simpleDb.privacyChainKeys?.getKey) {
      return undefined;
    }
    const scope = this.buildPrivacyKeyScope(p);
    try {
      const decrypted = await getDecryptedLocalWalletViewingKey({
        backgroundApi: this.backgroundApi,
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

  private async persistEncryptedViewingKey(p: {
    networkId: string;
    accountId: string;
    poolAddress: string;
    entry: IViewingKeyCacheEntry;
    password: string;
  }): Promise<void> {
    if (!p.password || !simpleDb.privacyChainKeys?.saveKey) {
      return;
    }
    const scope = this.buildPrivacyKeyScope(p);
    const vkFp = getViewingKeyFingerprint({
      networkId: p.networkId,
      viewingKey: p.entry.viewingKey,
    });
    await saveEncryptedLocalWalletViewingKey({
      backgroundApi: this.backgroundApi,
      accountId: p.accountId,
      scope,
      networkId: p.networkId,
      vkFp,
      plaintext: JSON.stringify(p.entry),
      password: p.password,
    }).catch(() => undefined);
  }

  private async removePersistedViewingKey(p: {
    networkId: string;
    accountId: string;
    poolAddress: string;
  }): Promise<void> {
    if (!simpleDb.privacyChainKeys?.removeKey) {
      return;
    }
    const scope = this.buildPrivacyKeyScope(p);
    await simpleDb.privacyChainKeys
      .removeKey({
        accountId: p.accountId,
        scope,
      })
      .catch(() => undefined);
  }

  /** Called from ServicePassword.clearCachedPassword and on account removal. */
  @backgroundMethod()
  async clearViewingKeyCache(): Promise<void> {
    this.viewingKeyGeneration += 1;
    this.keyGenerations.clear();
    this.viewingKeyDerivations.clear();
    this.privateBalanceRequests.clear();
    this.viewingKeyCache.clear();
    this.privateBalances.clear();
    this.historyCursors.clear();
  }

  // Password expiry invalidates in-flight authorizations. Read-only keys
  // already derived for this unlocked session remain usable until lock.
  invalidatePendingAuthorizations(): void {
    this.authorizationGeneration += 1;
  }

  // Prepare registered accounts while the verified password is available,
  // restoring encrypted viewing keys for both software and hardware accounts
  // and deriving unpersisted software accounts locally.
  async prepareUnlockedViewingKeys(): Promise<void> {
    const generation = this.viewingKeyGeneration;
    const records = await simpleDb.starknetPrivacy.getRegisteredAccounts();
    const eligibleAccounts = records.filter(
      ({ accountId }) =>
        accountUtils.isHdAccount({ accountId }) ||
        accountUtils.isImportedAccount({ accountId }) ||
        accountUtils.isHwAccount({ accountId }),
    );
    if (!eligibleAccounts.length || generation !== this.viewingKeyGeneration)
      return;
    const password =
      await this.backgroundApi.servicePassword?.getCachedPasswordForBackgroundRead?.();
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
      const cacheKey = this.buildCacheKey({
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
              if (await this.isDisabledByServer(networkId))
                throw strk20Error(EStrk20ErrorCode.Unavailable);
              if (generation !== this.viewingKeyGeneration)
                throw strk20Error(EStrk20ErrorCode.Locked);
              return { password };
            },
          }).catch(() => undefined);
        }
      }
    }
  }

  private getKeyGeneration(key: string): number {
    return this.keyGenerations.get(key) ?? 0;
  }

  private storeHistoryCursor(entry: IStoredHistoryCursor): string {
    const cursorId = generateUUID();
    if (this.historyCursors.size >= MAX_HISTORY_CURSORS) {
      const oldestKey = this.historyCursors.keys().next().value;
      if (oldestKey !== undefined) {
        this.historyCursors.delete(oldestKey);
      }
    }
    this.historyCursors.set(cursorId, entry);
    return cursorId;
  }

  private dropCachedViewingKey(p: {
    networkId: string;
    accountId: string;
    poolAddress: string;
  }): void {
    const key = this.buildCacheKey(p);
    this.keyGenerations.set(key, this.getKeyGeneration(key) + 1);
    this.viewingKeyDerivations.delete(key);
    this.viewingKeyCache.delete(key);
    void this.removePersistedViewingKey(p);
    for (const reqKey of this.privateBalanceRequests.keys()) {
      if (reqKey === key || reqKey.startsWith(`${key}|`)) {
        this.privateBalanceRequests.delete(reqKey);
      }
    }
    for (const balanceKey of this.privateBalances.keys()) {
      if (balanceKey.startsWith(`${key}|`)) {
        this.privateBalances.delete(balanceKey);
      }
    }
    for (const [cursorId, stored] of this.historyCursors.entries()) {
      if (stored.scopeKey === key) {
        this.historyCursors.delete(cursorId);
      }
    }
  }

  /**
   * Viewing keys are scoped to this service. The caller supplies credentials
   * according to whether the operation can interact with the user.
   */
  private async ensureViewingKey(p: {
    networkId: string;
    accountId: string;
    poolAddress: string;
    skipPersistedLookup?: boolean;
    resolveCredentials: () => Promise<{
      password: string;
      deviceParams?: IDeviceSharedCallParams;
    }>;
  }): Promise<IViewingKeyCacheEntry> {
    const generation = this.viewingKeyGeneration;
    const key = this.buildCacheKey(p);
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
        await this.backgroundApi.servicePassword?.getCachedPasswordForBackgroundRead?.();
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
      const vault = await this.getStarknetVault(p);
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
        ? await this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
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
        (await this.backgroundApi.servicePassword?.getCachedPasswordForBackgroundRead?.());
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
      if (this.viewingKeyDerivations.get(key) === request)
        this.viewingKeyDerivations.delete(key);
    }
  }

  // ------------------------------------------------------- sequencing (§3)

  /**
   * The sequencer accepts a proof only when its base block is at least
   * `sequencingCooldownBlocks` older than submission, and the same wait applies
   * after any transparent transaction the proof will read. Proving happens at
   * `latest - (cooldown - 1)` and against a finalized number, never a block tag:
   * `pre_confirmed` is fine for balances and nonces, not for proofs.
   */
  @backgroundMethod()
  async getSequencingState(
    p: IStrk20AccountKey,
  ): Promise<IStrk20SequencingState> {
    const poolSettings = await this.getPrivacyPoolSettings(p.networkId);
    if (!poolSettings) {
      return {
        status: EStrk20SequencingStatus.Unavailable,
        latestBlock: 0,
        blocksRemaining: 0,
        estimatedSecondsRemaining: 0,
      };
    }
    const cooldown = poolSettings.sequencingCooldownBlocks;
    const [vault, state] = await Promise.all([
      this.getStarknetVault(p),
      this.getAccountPrivacyState(p),
    ]);
    const client = await vault.getClient();
    const latestBlock = await client.getBlockNumber();
    let lastTxBlockNumber = state.lastTxBlockNumber;
    if (state.activationTxid) {
      const receipt = await client.getTransactionReceipt(state.activationTxid);
      const { getReceiptTxStatus } =
        await import('../../vaults/impls/starknet/utils');
      const status = getReceiptTxStatus(receipt);
      if (status === EOnChainHistoryTxStatus.Pending) {
        return {
          status: EStrk20SequencingStatus.Waiting,
          latestBlock,
          lastTxBlockNumber,
          blocksRemaining: cooldown,
          estimatedSecondsRemaining: 0,
        };
      }
      if (
        status === EOnChainHistoryTxStatus.Success &&
        receipt?.block_number !== undefined
      ) {
        lastTxBlockNumber = Math.max(
          lastTxBlockNumber ?? 0,
          receipt.block_number,
        );
      }
      await simpleDb.starknetPrivacy.patchRecord({
        ...p,
        poolAddress: state.poolAddress,
        expected: { activationTxid: state.activationTxid },
        patch: { activationTxid: undefined, lastTxBlockNumber },
      });
    }
    const address = await vault.getAccountAddress();
    if (!(await client.isAccountDeployed(address))) {
      return {
        status: EStrk20SequencingStatus.ActivationRequired,
        latestBlock,
        lastTxBlockNumber,
        blocksRemaining: 0,
        estimatedSecondsRemaining: 0,
      };
    }
    if (state.lastTransfer?.status === 'pending') {
      return {
        status: EStrk20SequencingStatus.Waiting,
        latestBlock,
        lastTxBlockNumber,
        blocksRemaining: cooldown,
        estimatedSecondsRemaining: 0,
      };
    }

    const { STARKNET_BLOCK_TIME_SECONDS } =
      await import('../../vaults/impls/starknet/sdkStarknet/consts');
    const elapsed =
      lastTxBlockNumber === undefined
        ? cooldown
        : latestBlock - lastTxBlockNumber;
    const blocksRemaining = Math.max(0, cooldown - elapsed);
    if (blocksRemaining > 0) {
      return {
        status: EStrk20SequencingStatus.Waiting,
        latestBlock,
        lastTxBlockNumber,
        blocksRemaining,
        estimatedSecondsRemaining:
          blocksRemaining * STARKNET_BLOCK_TIME_SECONDS,
      };
    }
    const provingBlockId = Math.max(0, latestBlock - (cooldown - 1));
    // SNIP-6 validation runs at the proof's historical block, not at the head.
    if (
      !(await client.isAccountDeployed(address, {
        block_number: provingBlockId,
      }))
    ) {
      return {
        status: EStrk20SequencingStatus.Waiting,
        latestBlock,
        lastTxBlockNumber,
        blocksRemaining: 1,
        estimatedSecondsRemaining: STARKNET_BLOCK_TIME_SECONDS,
      };
    }
    return {
      status: EStrk20SequencingStatus.Ready,
      latestBlock,
      lastTxBlockNumber,
      blocksRemaining: 0,
      estimatedSecondsRemaining: 0,
      provingBlockId,
    };
  }

  /**
   * Writer for the §3 gate. Called for every confirmed transaction from this
   * account, not just private ones: a plain ERC-20 transfer is state the next
   * proof reads, so it re-arms the wait just the same. No-op when the account
   * has no privacy record, and monotonic so a late receipt cannot rewind it.
   */
  @backgroundMethod()
  async noteAccountTouchedByTx(
    p: IStrk20AccountKey & { blockNumber: number },
  ): Promise<void> {
    const config = await this.getPrivacyConfig({ networkId: p.networkId });
    if (!config?.poolAddress) {
      return;
    }
    const existing = await simpleDb.starknetPrivacy.getRecord({
      networkId: p.networkId,
      accountId: p.accountId,
      poolAddress: config.poolAddress,
    });
    if (!existing) {
      return;
    }
    if (
      existing.lastTxBlockNumber !== undefined &&
      existing.lastTxBlockNumber >= p.blockNumber
    ) {
      return;
    }
    await simpleDb.starknetPrivacy.patchRecord({
      networkId: p.networkId,
      accountId: p.accountId,
      poolAddress: config.poolAddress,
      patch: { lastTxBlockNumber: p.blockNumber },
    });
  }

  // ---------------------------------------------- SDK-backed (A5/A7/A9)

  /**
   * Everything the SDK needs for one call. Reads pass `allowPrompt: false` and
   * get a signer that refuses to sign: discovery never signs, so a background
   * refresh must not be able to.
   */
  private async getPrivacyContext(
    p: {
      networkId: string;
      accountId: string;
      allowPrompt: boolean;
      purpose?: 'read' | 'register' | 'transfer';
    },
    knownConfig?: IStrk20PrivacyNetworkConfig,
  ) {
    const generation = this.viewingKeyGeneration;
    const authorization = this.authorizationGeneration;
    const config =
      knownConfig ?? (await this.getPrivacyConfig({ networkId: p.networkId }));
    if (!config) throw strk20Error(EStrk20ErrorCode.Unavailable);
    const poolAddress = config.poolAddress;
    const scopeKey = this.buildCacheKey({ ...p, poolAddress });
    const keyGeneration = this.getKeyGeneration(scopeKey);
    const assertSession = () => {
      if (
        generation !== this.viewingKeyGeneration ||
        keyGeneration !== this.getKeyGeneration(scopeKey) ||
        (p.purpose !== 'read' && authorization !== this.authorizationGeneration)
      ) {
        throw strk20Error(EStrk20ErrorCode.Locked);
      }
    };
    if (await this.isDisabledByServer(p.networkId))
      throw strk20Error(EStrk20ErrorCode.Unavailable);
    assertSession();
    const vault = await this.getStarknetVault(p);
    const client = await vault.getClient();
    if (!(await this.supportsPrivacyRpc(client, config)))
      throw strk20Error(EStrk20ErrorCode.Unavailable);
    const [account, network] = await Promise.all([
      vault.getAccount(),
      vault.getNetwork(),
    ]);

    assertSession();

    let cachedCredentials:
      | { password: string; deviceParams?: IDeviceSharedCallParams }
      | undefined;
    const resolveCredentials = async () => {
      assertSession();
      if (cachedCredentials) {
        return cachedCredentials;
      }
      if (!p.allowPrompt) {
        throw strk20Error(EStrk20ErrorCode.Locked);
      }
      const credentials =
        await this.backgroundApi.servicePassword.promptPasswordVerifyByAccount({
          accountId: p.accountId,
          reason:
            p.purpose === 'read'
              ? EReasonForNeedPassword.Default
              : EReasonForNeedPassword.CreateTransaction,
        });
      assertSession();
      cachedCredentials = credentials;
      return credentials;
    };
    const resolvePassword = async () => {
      if (p.purpose === 'read') throw strk20Error(EStrk20ErrorCode.Locked);
      return (await resolveCredentials()).password;
    };
    const resolveDeviceParams = async () =>
      (await resolveCredentials()).deviceParams;

    const viewing = await this.ensureViewingKey({
      networkId: p.networkId,
      accountId: p.accountId,
      poolAddress,
      resolveCredentials: async () => {
        const { accountId } = p;
        if (
          p.purpose === 'read' &&
          (accountUtils.isHdAccount({ accountId }) ||
            accountUtils.isImportedAccount({ accountId }))
        ) {
          const password =
            await this.backgroundApi.servicePassword.getCachedPasswordForBackgroundRead();
          assertSession();
          if (password) return { password };
        }
        return resolveCredentials();
      },
    });
    assertSession();

    const buildTransfers = async () => {
      const {
        buildOhttpOption,
        createStrk20ProverProxyFetch,
        createStrk20Signer,
        createStrk20Transfers,
      } = await import('../../vaults/impls/starknet/strk20Adapter');
      return createStrk20Transfers({
        accountAddress: account.address,
        signer: createStrk20Signer({
          keyring: {
            signStrk20ProofInvocation: async (params) => {
              assertSession();
              const sign = () =>
                (
                  vault.keyring as unknown as IKeyringStrk20ProofInvocationSigner
                ).signStrk20ProofInvocation(params);
              const signature = await (params.deviceParams
                ? this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
                    sign,
                    {
                      deviceParams: params.deviceParams,
                      debugMethodName: 'starknetPrivacy.authorizeProof',
                    },
                  )
                : sign());
              assertSession();
              return signature;
            },
          },
          resolvePassword,
          resolveDeviceParams: accountUtils.isHwAccount({
            accountId: p.accountId,
          })
            ? resolveDeviceParams
            : undefined,
          chainId: normalizeStarknetChainId(network.chainId),
          poolAddress,
        }),
        viewingKey: viewing.viewingKey,
        poolAddress,
        chainId: normalizeStarknetChainId(network.chainId),
        discoveryUrl: config.discoveryUrl,
        provingUrl: config.provingUrl,
        provingKind: config.provingKind,
        proverFetch: createStrk20ProverProxyFetch({
          networkId: p.networkId,
          post: (request, signal) =>
            this.postStrk20ProverProxy(request, signal),
        }),
        getProofNonce: async () =>
          BigInt(await client.getNonce(poolAddress, 'latest')),
        ohttp: buildOhttpOption(config.ohttp),
      });
    };

    return {
      config,
      poolAddress,
      vault,
      client,
      account,
      network,
      viewing,
      buildTransfers,
      resolvePassword,
      assertSession,
    };
  }

  /**
   * Refuses to build when the protocol has paused the pool or when the §3 wait
   * is still running, rather than letting the transaction revert on-chain.
   */
  private async assertBuildable(p: {
    networkId: string;
    accountId: string;
    poolAddress: string;
    client: { isPoolPaused: (poolAddress: string) => Promise<boolean> };
  }): Promise<IStrk20SequencingState & { provingBlockId: number }> {
    if (await p.client.isPoolPaused(p.poolAddress)) {
      throw strk20Error(EStrk20ErrorCode.PoolPaused);
    }
    const sequencing = await this.getSequencingState({
      networkId: p.networkId,
      accountId: p.accountId,
    });
    if (sequencing.status === EStrk20SequencingStatus.Unavailable) {
      throw strk20Error(EStrk20ErrorCode.Unavailable);
    }
    if (sequencing.status !== EStrk20SequencingStatus.Ready) {
      throw strk20Error(EStrk20ErrorCode.Waiting);
    }
    if (sequencing.provingBlockId === undefined) {
      // Ready always carries one; throwing beats defaulting to block 0, which
      // would silently ask the prover to prove against genesis.
      throw new OneKeyLocalError(
        'STRK20 sequencing reported ready without a proving block',
      );
    }
    return { ...sequencing, provingBlockId: sequencing.provingBlockId };
  }

  /**
   * Consent is already recorded by the time this runs (§4.2), so a failed
   * register never restarts the consent flow. The pool's viewing key is
   * write-once: a matching on-chain key (reinstall, new device, re-opt-in)
   * means already registered, and a differing one is a terminal `mismatch`.
   * Neither may lead to a second registration.
   */
  @backgroundMethod()
  async buildRegisterTx(
    p: IStrk20AccountKey & { resumeOnly?: boolean },
  ): Promise<
    | { alreadyRegistered: true }
    | { alreadyRegistered: false; unsignedTx: IUnsignedTxPro }
  > {
    const current = await this.getAccountPrivacyState(p);
    if (current.optInStatus === EStrk20OptInStatus.None)
      throw strk20Error(EStrk20ErrorCode.Unavailable);
    if (current.optInStatus === EStrk20OptInStatus.RegisterPending)
      throw strk20Error(EStrk20ErrorCode.Waiting);
    if (current.optInStatus === EStrk20OptInStatus.Mismatch)
      throw strk20Error(EStrk20ErrorCode.KeyMismatch);
    const ctx = await this.getPrivacyContext({
      ...p,
      allowPrompt: true,
      purpose: 'register',
    });
    const registered = await ctx.client.getPoolRegisteredPublicKey({
      poolAddress: ctx.poolAddress,
      accountAddress: ctx.account.address,
    });
    ctx.assertSession();
    if (registered && registered === ctx.viewing.publicKeyX) {
      const updated = await simpleDb.starknetPrivacy.patchRecord({
        ...p,
        poolAddress: ctx.poolAddress,
        expected: { optInStatus: current.optInStatus },
        patch: {
          optInStatus: EStrk20OptInStatus.Registered,
          registeredPublicKey: registered,
        },
      });
      ctx.assertSession();
      if (updated?.optInStatus !== EStrk20OptInStatus.Registered)
        throw strk20Error(EStrk20ErrorCode.Unavailable);
      return { alreadyRegistered: true };
    }
    if (registered) {
      const updated = await simpleDb.starknetPrivacy.patchRecord({
        ...p,
        poolAddress: ctx.poolAddress,
        expected: { optInStatus: current.optInStatus },
        patch: {
          optInStatus: EStrk20OptInStatus.Mismatch,
          registeredPublicKey: registered,
        },
      });
      ctx.assertSession();
      if (updated?.optInStatus !== EStrk20OptInStatus.Mismatch)
        throw strk20Error(EStrk20ErrorCode.Unavailable);
      this.dropCachedViewingKey({ ...p, poolAddress: ctx.poolAddress });
      throw strk20Error(EStrk20ErrorCode.KeyMismatch);
    }

    if (p.resumeOnly) throw strk20Error(EStrk20ErrorCode.Unavailable);

    const sequencing = await this.assertBuildable({
      ...p,
      poolAddress: ctx.poolAddress,
      client: ctx.client,
    });
    const { buildStrk20UnsignedTx } =
      await import('../../vaults/impls/starknet/strk20Protocol');
    const { unsignedTx } = await buildStrk20UnsignedTx({
      poolAddress: ctx.poolAddress,
      client: ctx.client,
      vault: ctx.vault,
      accountAddress: ctx.account.address,
      intent: { kind: 'register' },
      transfers: await ctx.buildTransfers(),
      assertSession: ctx.assertSession,
      provingBlockId: sequencing.provingBlockId,
    });
    ctx.assertSession();
    return { alreadyRegistered: false, unsignedTx };
  }

  private async getPrivateBalanceKey(p: IPrivateBalanceQuery): Promise<string> {
    const poolAddress = await this.resolvePoolAddress(p.networkId);
    const tokens = p.tokenAddresses
      ?.map((token) => BigInt(token).toString(16))
      .toSorted()
      .join(',');
    return `${this.buildCacheKey({ ...p, poolAddress })}|${tokens ?? '*'}`;
  }

  @backgroundMethod()
  async getCachedPrivateBalances(
    p: IPrivateBalanceQuery,
  ): Promise<IPrivateBalanceSnapshot | undefined> {
    const key = await this.getPrivateBalanceKey(p);
    return this.readCachedPrivateBalances(p, key);
  }

  private async readCachedPrivateBalances(
    p: IPrivateBalanceQuery,
    key: string,
  ): Promise<IPrivateBalanceSnapshot | undefined> {
    if (!this.privateBalances.has(key)) return undefined;
    if (
      (await this.isDisabledByServer(p.networkId)) ||
      (await this.getAccountPrivacyState(p)).optInStatus !==
        EStrk20OptInStatus.Registered
    ) {
      return undefined;
    }
    return this.privateBalances.get(key);
  }

  @backgroundMethod()
  async getPrivateBalances(
    p: IPrivateBalanceQuery,
  ): Promise<IPrivateBalanceSnapshot> {
    const generation = this.viewingKeyGeneration;
    const key = await this.getPrivateBalanceKey(p);
    const cached = await this.readCachedPrivateBalances(p, key);
    if (generation !== this.viewingKeyGeneration) {
      throw strk20Error(EStrk20ErrorCode.Locked);
    }
    const unlocking = this.privateBalanceRequests.get(`${key}|true`);
    if (unlocking) return unlocking;
    if (
      cached &&
      Date.now() - cached.lastSyncedAt < PRIVATE_BALANCE_REFRESH_INTERVAL_MS
    ) {
      return cached;
    }
    return this.refreshPrivateBalances(p);
  }

  @backgroundMethod()
  async refreshPrivateBalances(
    p: IPrivateBalanceQuery & { allowPrompt?: boolean },
  ): Promise<IPrivateBalanceSnapshot> {
    const generation = this.viewingKeyGeneration;
    const key = await this.getPrivateBalanceKey(p);
    if (generation !== this.viewingKeyGeneration) {
      throw strk20Error(EStrk20ErrorCode.Locked);
    }
    const requestKey = `${key}|${p.allowPrompt === true}`;
    const pending = this.privateBalanceRequests.get(requestKey);
    if (pending) return pending;

    const request = this.fetchPrivateBalances(p).then((snapshot) => {
      if (generation !== this.viewingKeyGeneration) {
        throw strk20Error(EStrk20ErrorCode.Locked);
      }
      const previous = this.privateBalances.get(key);
      if (previous && previous.blockNumber > snapshot.blockNumber) {
        return previous;
      }
      this.privateBalances.set(key, snapshot);
      return snapshot;
    });
    this.privateBalanceRequests.set(requestKey, request);
    try {
      return await request;
    } finally {
      if (this.privateBalanceRequests.get(requestKey) === request) {
        this.privateBalanceRequests.delete(requestKey);
      }
    }
  }

  private async fetchPrivateBalances(
    p: IPrivateBalanceQuery & { allowPrompt?: boolean },
  ): Promise<IPrivateBalanceSnapshot> {
    const ctx = await this.getRegisteredPrivacyContext(
      p,
      'read',
      p.allowPrompt === true,
    );
    if (!ctx) throw strk20Error(EStrk20ErrorCode.Unavailable);
    const transfers = await ctx.buildTransfers();
    // A finalized number, so the amounts and the block they are true at agree.
    const blockNumber = await ctx.client.getBlockNumber();
    ctx.assertSession();
    const discovered = await transfers.discoverNotes({
      tokens: p.tokenAddresses?.map((token) => BigInt(token)),
      blockIdentifier: blockNumber,
    });
    ctx.assertSession();

    const { normalizeTokenAddress, toHexFelt } =
      await import('../../vaults/impls/starknet/utils');
    const byToken: Record<string, string> = {};
    let noteCount = 0;
    for (const [token, notes] of discovered.notes.entries()) {
      const total = notes.reduce(
        (sum, note) => sum + BigInt(note.amount),
        BigInt(0),
      );
      byToken[normalizeTokenAddress(toHexFelt(token))] = total.toString(10);
      noteCount += notes.length;
    }

    const lastSyncedAt = Date.now();
    await simpleDb.starknetPrivacy.patchRecord({
      ...p,
      poolAddress: ctx.poolAddress,
      patch: { lastRefreshAt: lastSyncedAt },
    });
    ctx.assertSession();
    return { byToken, noteCount, blockNumber, lastSyncedAt };
  }

  private async getRegisteredPrivacyContext(
    p: IStrk20AccountKey,
    purpose: 'read' | 'transfer' = 'transfer',
    allowPrompt = true,
  ) {
    const generation = this.viewingKeyGeneration;
    const config = await this.getPrivacyConfig(p);
    if (!config) throw strk20Error(EStrk20ErrorCode.Unavailable);
    const scopeKey = this.buildCacheKey({
      ...p,
      poolAddress: config.poolAddress,
    });
    const keyGeneration = this.getKeyGeneration(scopeKey);
    const state = await this.getAccountPrivacyState(p);
    if (
      generation !== this.viewingKeyGeneration ||
      keyGeneration !== this.getKeyGeneration(scopeKey)
    ) {
      throw strk20Error(EStrk20ErrorCode.Locked);
    }
    if (state.optInStatus !== EStrk20OptInStatus.Registered) return undefined;
    const ctx = await this.getPrivacyContext(
      {
        ...p,
        allowPrompt,
        purpose,
      },
      config,
    );
    const current = allowPrompt ? await this.getAccountPrivacyState(p) : state;
    if (
      current.optInStatus !== EStrk20OptInStatus.Registered ||
      (allowPrompt && (await this.isDisabledByServer(p.networkId)))
    ) {
      this.dropCachedViewingKey({ ...p, poolAddress: ctx.poolAddress });
      throw strk20Error(EStrk20ErrorCode.Unavailable);
    }
    const registeredKey =
      current.registeredPublicKey ??
      (await ctx.client.getPoolRegisteredPublicKey({
        poolAddress: ctx.poolAddress,
        accountAddress: ctx.account.address,
      }));
    ctx.assertSession();
    if (!registeredKey || registeredKey !== ctx.viewing.publicKeyX) {
      this.dropCachedViewingKey({ ...p, poolAddress: ctx.poolAddress });
      throw strk20Error(EStrk20ErrorCode.KeyMismatch);
    }
    return ctx;
  }

  @backgroundMethod()
  async isRecipientRegistered(p: {
    networkId: string;
    recipient: string;
  }): Promise<boolean> {
    const [poolAddress, vault] = await Promise.all([
      this.resolvePoolAddress(p.networkId),
      this.getStarknetVault({ networkId: p.networkId }),
    ]);
    const client = await vault.getClient();
    return Boolean(
      await client.getPoolRegisteredPublicKey({
        poolAddress,
        accountAddress: p.recipient,
      }),
    );
  }

  /**
   * Note-anchored and incomplete by construction (doc 01 §7): a withdrawal
   * sharing a transaction with our notes cannot be attributed to its initiator
   * because `user_addr` is encrypted, and bundled multi-user deposits are
   * filtered out upstream. The UI must not present it as authoritative.
   */
  @backgroundMethod()
  async fetchPrivateHistory(
    p: IStrk20AccountKey & {
      tokenAddress: string;
      cursor?: IStrk20HistoryCursor;
    },
  ): Promise<{
    txs: IAccountHistoryTx[];
    discoveryTxIds: string[];
    hasMore: boolean;
    isEnabled?: boolean;
    cursor?: IStrk20HistoryCursor;
  }> {
    const ctx = await this.getRegisteredPrivacyContext(p, 'read', false);
    if (!ctx)
      return { txs: [], discoveryTxIds: [], hasMore: false, isEnabled: false };
    const scopeKey = this.buildCacheKey({
      networkId: p.networkId,
      accountId: p.accountId,
      poolAddress: ctx.poolAddress,
    });
    const generation = this.viewingKeyGeneration;
    const keyGeneration = this.getKeyGeneration(scopeKey);
    let internalCursor: IStrk20InternalHistoryCursor | undefined;
    if (p.cursor?.cursorId) {
      const stored = this.historyCursors.get(p.cursor.cursorId);
      if (
        !stored ||
        stored.scopeKey !== scopeKey ||
        stored.generation !== generation ||
        stored.keyGeneration !== keyGeneration
      ) {
        throw strk20Error(EStrk20ErrorCode.History);
      }
      internalCursor = { cursor: stored.cursor, blockRef: stored.blockRef };
    }
    const { fetchStrk20HistoryPage, buildOhttpOption } =
      await import('../../vaults/impls/starknet/strk20Adapter');
    const page = await fetchStrk20HistoryPage({
      discoveryUrl: ctx.config.discoveryUrl,
      poolAddress: ctx.poolAddress,
      accountAddress: ctx.account.address,
      viewingKey: ctx.viewing.viewingKey,
      cursor: internalCursor,
      ohttp: buildOhttpOption(ctx.config.ohttp),
    });
    ctx.assertSession();

    let tokenMetadata: Promise<IToken | undefined> | undefined;
    const getTokenInfo = () => {
      tokenMetadata ??= this.backgroundApi.serviceToken
        .fetchTokensDetails({
          networkId: p.networkId,
          accountId: p.accountId,
          contractList: [p.tokenAddress],
        })
        .then((items) => items?.[0]?.info);
      return tokenMetadata;
    };
    const { buildStrk20HistoryTx } =
      await import('../../vaults/impls/starknet/strk20Protocol');
    const txs = await Promise.all(
      page.transactions.map((transaction) =>
        buildStrk20HistoryTx({
          vault: ctx.vault,
          networkId: p.networkId,
          accountId: p.accountId,
          accountAddress: ctx.account.address,
          poolAddress: ctx.poolAddress,
          transaction,
          tokenAddress: p.tokenAddress,
          getTokenInfo,
        }),
      ),
    );
    const localTxs = await this.fetchLocalPrivateHistory({
      ...p,
      ctx,
      getTokenInfo,
    });
    const byHash = new Map(
      localTxs.map((tx) => [BigInt(tx.decodedTx.txid).toString(), tx]),
    );
    for (const tx of txs) {
      if (tx) {
        const hash = BigInt(tx.decodedTx.txid).toString();
        const local = byHash.get(hash);
        const localExtra = local?.decodedTx.extraInfo as
          | IDecodedTxExtraStarknet
          | undefined;
        const discoveredExtra = tx.decodedTx.extraInfo as
          | IDecodedTxExtraStarknet
          | undefined;
        byHash.set(hash, {
          ...tx,
          isLocalCreated: local?.isLocalCreated ?? tx.isLocalCreated,
          decodedTx: {
            ...tx.decodedTx,
            createdAt: tx.decodedTx.createdAt ?? local?.decodedTx.createdAt,
            updatedAt: tx.decodedTx.updatedAt ?? local?.decodedTx.updatedAt,
            nonce: local?.decodedTx.nonce ?? tx.decodedTx.nonce,
            totalFeeInNative: local?.decodedTx.totalFeeInNative,
            protocolFeeInNative: local?.decodedTx.protocolFeeInNative,
            totalFeeFiatValue: local?.decodedTx.totalFeeFiatValue,
            extraInfo: localExtra
              ? {
                  ...localExtra,
                  ...discoveredExtra,
                  privacy: discoveredExtra?.privacy
                    ? { ...localExtra.privacy, ...discoveredExtra.privacy }
                    : localExtra.privacy,
                }
              : tx.decodedTx.extraInfo,
          },
        });
      }
    }
    const datedTxs = await Promise.all(
      [...byHash.values()].map(async (tx) => {
        const { block, createdAt, updatedAt } = tx.decodedTx;
        if (createdAt || updatedAt || block === undefined) return tx;
        const seconds = await ctx.client.getBlockTimestamp(block);
        if (seconds === undefined) return tx;
        const time = seconds * 1000;
        return {
          ...tx,
          decodedTx: { ...tx.decodedTx, createdAt: time, updatedAt: time },
        };
      }),
    );
    ctx.assertSession();
    const hasMore = !page.cursor.historyComplete;
    const cursor = hasMore
      ? {
          cursorId: this.storeHistoryCursor({
            scopeKey,
            generation,
            keyGeneration,
            cursor: page.cursor,
            blockRef: page.blockRef,
          }),
        }
      : undefined;
    return {
      txs: sortHistoryTxsByTime({ txs: datedTxs }),
      discoveryTxIds: txs.flatMap((tx) => (tx ? [tx.id] : [])),
      hasMore,
      isEnabled: true,
      ...(cursor ? { cursor } : {}),
    };
  }

  private async fetchLocalPrivateHistory(
    params: IStrk20AccountKey & {
      tokenAddress: string;
      ctx: Awaited<ReturnType<ServiceStarknetPrivacy['getPrivacyContext']>>;
      getTokenInfo: () => Promise<IToken | undefined>;
    },
  ): Promise<IAccountHistoryTx[]> {
    const { serviceHistory } = this.backgroundApi;
    const query = {
      networkId: params.networkId,
      accountAddress: params.ctx.account.address,
      tokenIdOnNetwork: params.tokenAddress,
    };
    const [pending, confirmed] = await Promise.all([
      serviceHistory.getAccountLocalHistoryPendingTxs(query),
      serviceHistory.getAccountLocalHistoryConfirmedTxs(query),
    ]);
    const txs = [...pending, ...confirmed].filter((tx) => {
      const intent = (
        tx.decodedTx.extraInfo as IDecodedTxExtraStarknet | undefined
      )?.privacy;
      return (
        intent &&
        intent.kind !== 'register' &&
        intent.tokenAddress &&
        BigInt(intent.tokenAddress) === BigInt(params.tokenAddress) &&
        BigInt(intent.poolAddress) === BigInt(params.ctx.poolAddress)
      );
    });
    if (!txs.length) return [];
    const token = await params.getTokenInfo();
    if (!token) return [];
    const { getReceiptTxStatus, getReceiptFeeInNative } =
      await import('../../vaults/impls/starknet/utils');
    const { PRIVATE_HISTORY_POOL_ID } =
      await import('../../vaults/impls/starknet/strk20Protocol');
    const settled: IAccountHistoryTx[] = [];
    const projected = await Promise.all(
      txs.map(async (tx) => {
        const intent = (tx.decodedTx.extraInfo as IDecodedTxExtraStarknet)
          .privacy;
        if (!intent?.amount) return tx;
        let status = tx.decodedTx.status;
        let decodedTx = tx.decodedTx;
        if (status === EDecodedTxStatus.Pending) {
          const receipt = await params.ctx.client
            .getTransactionReceipt(tx.decodedTx.txid)
            .catch(() => null);
          const onChainStatus = getReceiptTxStatus(receipt);
          if (onChainStatus === EOnChainHistoryTxStatus.Success)
            status = EDecodedTxStatus.Confirmed;
          if (onChainStatus === EOnChainHistoryTxStatus.Failed)
            status = EDecodedTxStatus.Failed;
          if (status !== EDecodedTxStatus.Pending) {
            const totalFeeInNative =
              getReceiptFeeInNative(
                receipt,
                params.ctx.network.feeMeta.decimals,
              ) ?? decodedTx.totalFeeInNative;
            decodedTx = {
              ...decodedTx,
              status,
              isFinal: true,
              block: receipt?.block_number ?? decodedTx.block,
              totalFeeInNative,
              totalFeeFiatValue: scaleFeeFiatValueToNativeFee({
                feeFiatValue: decodedTx.totalFeeFiatValue,
                feeInNative: decodedTx.totalFeeInNative,
                nextFeeInNative: totalFeeInNative,
              }),
            };
            settled.push({ ...tx, decodedTx });
          }
        }
        const amount = new BigNumber(intent.amount).shiftedBy(-token.decimals);
        const isSelfTransfer =
          intent.kind === 'transfer' &&
          intent.recipient &&
          BigInt(intent.recipient) === BigInt(params.ctx.account.address);
        const delta = isSelfTransfer
          ? '0'
          : (intent.kind === 'deposit' ? amount : amount.negated()).toFixed();
        return projectPrivacyChainHistoryTxToPool({
          tx: {
            ...tx,
            privacyChainHistorySide: 'private',
            privacyChainHistoryPoolIds: [PRIVATE_HISTORY_POOL_ID],
            privacyChainHistoryPoolDeltas: { [PRIVATE_HISTORY_POOL_ID]: delta },
            privacyChainHistoryFeePoolId: 0,
            decodedTx,
          },
          selectedPoolId: PRIVATE_HISTORY_POOL_ID,
        });
      }),
    );
    params.ctx.assertSession();
    if (settled.length) {
      await this.backgroundApi.simpleDb.localHistory.batchUpdateLocalHistoryTxs(
        [
          {
            networkId: query.networkId,
            accountAddress: query.accountAddress,
            confirmedTxs: settled,
            confirmedTxsToSave: settled,
          },
        ],
      );
    }
    return projected;
  }

  /**
   * Amounts are base-unit integer strings, matching
   * `IStrk20PrivateBalances.byToken`; nothing here re-scales by decimals.
   */
  async buildPrivateTransferTx(
    p: IStrk20AccountKey & {
      kind: IStrk20TransferKind;
      tokenAddress: string;
      amount: string;
      recipient?: string;
    },
  ): Promise<{ unsignedTx: IUnsignedTxPro; warnings: IStrk20Warning[] }> {
    if (await this.isDisabledByServer(p.networkId))
      throw strk20Error(EStrk20ErrorCode.Unavailable);
    if (
      p.kind === 'transfer' &&
      (!p.recipient ||
        !(await this.isRecipientRegistered({
          networkId: p.networkId,
          recipient: p.recipient,
        })))
    ) {
      throw strk20Error(EStrk20ErrorCode.RecipientNotRegistered);
    }
    // Normalized once and shared by both consumers. Rounding twice — here for
    // the SDK and again inside wrapCallAndProof for the approve — can differ by
    // one base unit on a non-integer input, and apply_actions reverts when the
    // allowance is short by any amount.
    const { parseStrk20BaseAmount, buildStrk20UnsignedTx } =
      await import('../../vaults/impls/starknet/strk20Protocol');
    const amountBase = parseStrk20BaseAmount(p.amount);
    if (amountBase === '0') throw strk20Error(EStrk20ErrorCode.InvalidAmount);
    const poolAddress = await this.resolvePoolAddress(p.networkId);
    const vault = await this.getStarknetVault(p);
    const client = await vault.getClient();
    const sequencing = await this.assertBuildable({
      ...p,
      poolAddress,
      client,
    });
    let protocolFee: string | undefined;
    if (p.kind === 'deposit') {
      const { STRK_TOKEN_ADDRESS } =
        await import('../../vaults/impls/starknet/sdkStarknet/consts');
      const { normalizeTokenAddress, u256ToDecimalString } =
        await import('../../vaults/impls/starknet/utils');
      const accountAddress = await vault.getAccountAddress();
      const [fee, [low, high]] = await Promise.all([
        client.getPoolFeeAmount(poolAddress),
        client.getTokenBalance({
          tokenAddress: STRK_TOKEN_ADDRESS,
          accountAddress,
        }),
      ]);
      protocolFee = fee;
      const required = new BigNumber(fee).plus(
        normalizeTokenAddress(p.tokenAddress) === STRK_TOKEN_ADDRESS
          ? amountBase
          : 0,
      );
      if (required.gt(u256ToDecimalString(low, high))) {
        const key = ETranslations.send_error_insufficient_balance;
        const info = { token: 'STRK' };
        throw new OneKeyLocalError({
          key,
          info,
          message: appLocale.intl.formatMessage({ id: key }, info),
        });
      }
    }
    const ctx = await this.getRegisteredPrivacyContext(p);
    if (!ctx) throw strk20Error(EStrk20ErrorCode.Unavailable);

    const built = await buildStrk20UnsignedTx({
      poolAddress: ctx.poolAddress,
      client: ctx.client,
      vault: ctx.vault,
      accountAddress: ctx.account.address,
      intent: {
        kind: p.kind,
        tokenAddress: p.tokenAddress,
        amount: amountBase,
        recipient: p.recipient,
      },
      transfers: await ctx.buildTransfers(),
      assertSession: ctx.assertSession,
      provingBlockId: sequencing.provingBlockId,
      protocolFee,
    });
    ctx.assertSession();
    return built;
  }
}

export default ServiceStarknetPrivacy;
