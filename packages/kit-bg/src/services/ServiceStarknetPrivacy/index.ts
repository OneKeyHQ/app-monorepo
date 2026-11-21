import BigNumber from 'bignumber.js';

import type {
  IDecodedTxExtraStarknet,
  IEncodedTxStarknetPrivacy,
  IStarknetCall,
} from '@onekeyhq/core/src/chains/starknet/types';
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
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  scaleFeeFiatValueToNativeFee,
  sortHistoryTxsByTime,
} from '@onekeyhq/shared/src/utils/historyUtils';
import { projectPrivacyChainHistoryTxToPool } from '@onekeyhq/shared/src/utils/privacyChainHistoryUtils';
import { STRK20_LOCAL_ERRORS } from '@onekeyhq/shared/src/utils/strk20ErrorUtils';
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
  type EStrk20SetupRequirement,
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
import { vaultFactory } from '../../vaults/factory';
import {
  STARKNET_BLOCK_TIME_SECONDS,
  STRK20_PRIVACY_CONFIG,
  STRK_TOKEN_ADDRESS,
} from '../../vaults/impls/starknet/sdkStarknet/consts';
import { isLocalWalletPrivacyDisabled } from '../../vaults/localWallet/remoteConfig';
import ServiceBase from '../ServiceBase';

import {
  buildOhttpOption,
  createStrk20ProverProxyFetch,
  createStrk20Signer,
  createStrk20Transfers,
  fetchStrk20HistoryPage,
  getStrk20HistoryTransfers,
  serializeHistoryCursor,
} from './strk20Sdk';

import type { IStrk20ProverProxyItem } from './strk20Sdk';
import type ClientStarknet from '../../vaults/impls/starknet/sdkStarknet/ClientStarknet';
import type { HistoryTransaction as IStrk20HistoryTransactionLike } from '../../vaults/impls/starknet/sdkStarknet/privacy';
import type StarknetVault from '../../vaults/impls/starknet/Vault';
import type {
  IKeyringStrk20ProofInvocationSigner,
  IKeyringStrk20ViewingKeyDeriver,
  IVaultSettingsPrivacyPool,
} from '../../vaults/types';

/**
 * The starknet vault utils pull in starknet.js through the core SDK. The import
 * is dynamic so the bg startup bundle does not carry that library for users who
 * never touch Starknet.
 */
async function loadStarknetUtils() {
  return import('../../vaults/impls/starknet/utils');
}

/** Matches the PRF master key cache: a derived secret on a short fixed TTL. */
const VIEWING_KEY_CACHE_DURATION_MS = 5 * 60 * 1000;
const PRIVATE_BALANCE_REFRESH_INTERVAL_MS = 60_000;
// Display identity for this network's configured private pool; the contract address stays in extraInfo.
const PRIVATE_HISTORY_POOL_ID = 1;

/**
 * `new OneKeyLocalError({ key })` alone is not translated — it surfaces the raw
 * key string — so background errors have to carry a formatted message.
 */
function strk20Error(code: keyof typeof STRK20_LOCAL_ERRORS): OneKeyLocalError {
  const mapping = STRK20_LOCAL_ERRORS[code];
  return new OneKeyLocalError({
    key: mapping.translationKey,
    message: appLocale.intl.formatMessage({ id: mapping.translationKey }),
    data: { starknetPrivacyErrorCode: code },
  });
}

/**
 * Stateless discovery: always re-discover, never persist a note registry. Doc 01
 * §7 recommends exactly this, and it means nothing local can disagree with the
 * chain. `autoSetup` lets a first transfer to a new recipient carry its own
 * channel-opening actions.
 */
const STATELESS_EXECUTE_OPTIONS = {
  autoDiscover: { notes: 'refresh', channels: 'refresh' },
  autoSetup: true,
  autoSelectNotes: 'all',
} as const;

/**
 * The parts of the SDK's `CallAndProof` this service reads. `calldata` is typed
 * loosely because starknet.js's `Call` allows an unencoded object, even though
 * `buildExecuteResult` always emits a felt array; wrapCallAndProof checks.
 */
type ICallAndProofLike = {
  call: { contractAddress: string; entrypoint: string; calldata?: unknown };
  proof: { data: string; proofFacts: string[] };
};

type IViewingKeyCacheEntry = {
  viewingKey: string;
  publicKeyX: string;
};

/** Cache entries expire individually; one shared timer only sweeps. */
type IViewingKeyCacheRecord = IViewingKeyCacheEntry & { expiresAt: number };

type IPrivateBalanceQuery = IStrk20AccountKey & { tokenAddresses?: string[] };
type IPrivateBalanceSnapshot = IStrk20PrivateBalances & {
  lastSyncedAt: number;
};

function unrefTimeout(timeout: ReturnType<typeof setTimeout> | null) {
  (
    timeout as ReturnType<typeof setTimeout> & { unref?: () => void }
  )?.unref?.();
}

function parseSpecVersion(version: string): number[] {
  return version
    .split('.')
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
}

/** true when `version` is at least `minimum`, comparing major.minor.patch. */
export function isSpecVersionAtLeast(
  version: string,
  minimum: string,
): boolean {
  const actual = parseSpecVersion(version);
  const wanted = parseSpecVersion(minimum);
  for (let i = 0; i < Math.max(actual.length, wanted.length); i += 1) {
    const a = actual[i] ?? 0;
    const w = wanted[i] ?? 0;
    if (a !== w) {
      return a > w;
    }
  }
  return true;
}

/**
 * Amounts arrive as base-unit integer strings. A decimal or exponent form is a
 * caller bug, not something to round: the SDK and the approve would each round
 * independently and the allowance could come out one unit short.
 */
export function parseStrk20BaseAmount(amount: string): string {
  const value = new BigNumber(amount);
  if (!value.isFinite() || value.isNegative() || !value.isInteger()) {
    throw strk20Error(EStrk20ErrorCode.InvalidAmount);
  }
  return value.toFixed(0);
}

/**
 * STRK20 private transfers on Starknet.
 *
 * bg-only by construction: the viewing key is derived here, cached here and
 * never returned from a `@backgroundMethod()`. The service never signs and
 * never broadcasts — signing stays in the keyring, submission in the vault.
 */
@backgroundClass()
class ServiceStarknetPrivacy extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
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

  private viewingKeyCache = new Map<string, IViewingKeyCacheRecord>();
  private viewingKeyGeneration = 0;

  private viewingKeyCacheTimeout: ReturnType<typeof setTimeout> | null = null;

  // Display snapshots share the viewing session's cleanup and stay in memory.
  private privateBalances = new Map<string, IPrivateBalanceSnapshot>();

  private privateBalanceRequests = new Map<
    string,
    Promise<IPrivateBalanceSnapshot>
  >();

  // ---------------------------------------------------------------- config

  @backgroundMethod()
  async getPrivacyConfig(p: {
    networkId: string;
  }): Promise<IStrk20PrivacyNetworkConfig | undefined> {
    return STRK20_PRIVACY_CONFIG[p.networkId];
  }

  /**
   * The server's switch, shared with Zcash and Monero: `privacyDisabled` in the
   * network list's `extensions.localWallet`. Off blocks the feature and keeps
   * every local record.
   */
  private async isDisabledByServer(networkId: string): Promise<boolean> {
    await this.backgroundApi.serviceCustomRpc.ensureLocalWalletRemoteConfigLoaded();
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
    if (p.accountId && !this.canAccountUsePrivacy(p.accountId)) {
      return false;
    }

    const vault = await this.getStarknetVault({
      networkId: p.networkId,
      accountId: p.accountId,
    });
    const client = await vault.getClient();
    const specVersion = await client.getSpecVersion();
    if (!isSpecVersionAtLeast(specVersion, config.minRpcSpecVersion)) {
      return false;
    }
    return true;
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

  /** Watching and external accounts cannot authorize pool operations. */
  private canAccountUsePrivacy(accountId: string): boolean {
    return !(
      accountUtils.isWatchingAccount({ accountId }) ||
      accountUtils.isExternalAccount({ accountId })
    );
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
      const { getReceiptTxStatus } = await loadStarknetUtils();
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
      const { getReceiptTxStatus } = await loadStarknetUtils();
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
      chainId: network.chainId,
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
    await simpleDb.starknetPrivacy.upsertRecord({
      networkId: p.networkId,
      accountId: p.accountId,
      poolAddress,
      record: {
        ...current,
        optInStatus: EStrk20OptInStatus.Consented,
        consentAcceptedAt: p.consentAcceptedAt,
      },
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

  /** Called from ServicePassword.clearCachedPassword and on account removal. */
  @backgroundMethod()
  async clearViewingKeyCache(): Promise<void> {
    this.viewingKeyGeneration += 1;
    this.viewingKeyCache.clear();
    this.privateBalances.clear();
    this.privateBalanceRequests.clear();
    if (this.viewingKeyCacheTimeout) {
      clearTimeout(this.viewingKeyCacheTimeout);
      this.viewingKeyCacheTimeout = null;
    }
  }

  private dropCachedViewingKey(p: {
    networkId: string;
    accountId: string;
    poolAddress: string;
  }): void {
    this.viewingKeyGeneration += 1;
    const key = this.buildCacheKey(p);
    this.viewingKeyCache.delete(key);
    this.privateBalanceRequests.clear();
    for (const balanceKey of this.privateBalances.keys()) {
      if (balanceKey.startsWith(`${key}|`)) {
        this.privateBalances.delete(balanceKey);
      }
    }
  }

  /**
   * Each entry carries its own deadline, so deriving one account's key cannot
   * extend another's TTL. The timer is only a sweeper: reads check `expiresAt`,
   * so an entry is never served past its own deadline even if the sweep is late.
   */
  private cacheViewingKey(
    p: { networkId: string; accountId: string; poolAddress: string },
    entry: IViewingKeyCacheEntry,
  ): void {
    this.viewingKeyCache.set(this.buildCacheKey(p), {
      ...entry,
      expiresAt: Date.now() + VIEWING_KEY_CACHE_DURATION_MS,
    });
    this.scheduleViewingKeySweep();
  }

  private scheduleViewingKeySweep(): void {
    if (this.viewingKeyCacheTimeout) {
      return;
    }
    this.viewingKeyCacheTimeout = setTimeout(() => {
      this.viewingKeyCacheTimeout = null;
      const now = Date.now();
      for (const [key, record] of this.viewingKeyCache.entries()) {
        if (record.expiresAt <= now) {
          this.viewingKeyCache.delete(key);
        }
      }
      if (this.viewingKeyCache.size > 0) {
        this.scheduleViewingKeySweep();
      }
    }, VIEWING_KEY_CACHE_DURATION_MS);
    unrefTimeout(this.viewingKeyCacheTimeout);
  }

  private readCachedViewingKey(p: {
    networkId: string;
    accountId: string;
    poolAddress: string;
  }): IViewingKeyCacheEntry | undefined {
    const key = this.buildCacheKey(p);
    const record = this.viewingKeyCache.get(key);
    if (!record) {
      return undefined;
    }
    if (record.expiresAt <= Date.now()) {
      this.viewingKeyCache.delete(key);
      return undefined;
    }
    return { viewingKey: record.viewingKey, publicKeyX: record.publicKeyX };
  }

  /**
   * Viewing keys are scoped to this service. The caller supplies credentials
   * according to whether the operation can interact with the user.
   */
  private async ensureViewingKey(p: {
    networkId: string;
    accountId: string;
    poolAddress: string;
    resolveCredentials: () => Promise<{
      password: string;
      deviceParams?: IDeviceSharedCallParams;
    }>;
  }): Promise<IViewingKeyCacheEntry> {
    const generation = this.viewingKeyGeneration;
    const cached = this.readCachedViewingKey(p);
    if (cached) {
      return cached;
    }
    if (!this.canAccountUsePrivacy(p.accountId)) {
      throw strk20Error(EStrk20ErrorCode.Unavailable);
    }

    const credentials = await p.resolveCredentials();

    const vault = await this.getStarknetVault(p);
    const keyring = vault.keyring as unknown as IKeyringStrk20ViewingKeyDeriver;
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
        chainId: network.chainId,
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
    if (generation !== this.viewingKeyGeneration) {
      throw strk20Error(EStrk20ErrorCode.Locked);
    }
    this.cacheViewingKey(p, entry);
    return entry;
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
      const { getReceiptTxStatus } = await loadStarknetUtils();
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
  private async getPrivacyContext(p: {
    networkId: string;
    accountId: string;
    allowPrompt: boolean;
    purpose?: 'read' | 'register' | 'transfer';
  }) {
    const generation = this.viewingKeyGeneration;
    const assertSession = () => {
      if (generation !== this.viewingKeyGeneration) {
        throw strk20Error(EStrk20ErrorCode.Locked);
      }
    };
    const config = await this.getPrivacyConfig({ networkId: p.networkId });
    if (!config || (await this.isDisabledByServer(p.networkId))) {
      throw strk20Error(EStrk20ErrorCode.Unavailable);
    }
    const poolAddress = config.poolAddress;
    const vault = await this.getStarknetVault(p);
    const client = await vault.getClient();
    const [account, network] = await Promise.all([
      vault.getAccount(),
      vault.getNetwork(),
    ]);

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
    const resolvePassword = async () => (await resolveCredentials()).password;
    const resolveDeviceParams = async () =>
      (await resolveCredentials()).deviceParams;

    const viewing = await this.ensureViewingKey({
      networkId: p.networkId,
      accountId: p.accountId,
      poolAddress,
      resolveCredentials: p.allowPrompt
        ? resolveCredentials
        : async () => {
            const { accountId } = p;
            const password =
              accountUtils.isHdAccount({ accountId }) ||
              accountUtils.isImportedAccount({ accountId })
                ? await this.backgroundApi.servicePassword.getCachedPasswordForBackgroundRead()
                : undefined;
            assertSession();
            if (!password) throw strk20Error(EStrk20ErrorCode.Locked);
            return { password };
          },
    });
    assertSession();

    const buildTransfers = async () =>
      createStrk20Transfers({
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
          chainId: network.chainId,
          poolAddress,
        }),
        viewingKey: viewing.viewingKey,
        poolAddress,
        chainId: network.chainId,
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
   * Wraps a proven `CallAndProof` into our send pipeline. `apply_actions` pulls
   * its STRK fee from the caller first, so the allowance rides in the same
   * transaction: a separate approve would be a transparent tx the next proof
   * reads, which re-arms the §3 wait.
   */
  private async wrapCallAndProof(params: {
    networkId: string;
    accountId: string;
    poolAddress: string;
    client: ClientStarknet;
    vault: StarknetVault;
    accountAddress: string;
    kind: EStrk20PrivateTxKind;
    result: { callAndProof: ICallAndProofLike; warnings?: IStrk20Warning[] };
    provingBlockId: number;
    tokenAddress?: string;
    amount?: string;
    recipient?: string;
  }): Promise<{ unsignedTx: IUnsignedTxPro; warnings: IStrk20Warning[] }> {
    const { call, proof } = params.result.callAndProof;
    const warnings = params.result.warnings ?? [];
    const {
      buildErc20ApproveCall,
      normalizeStarknetAddress,
      normalizeTokenAddress,
      toHexFelt,
    } = await loadStarknetUtils();

    const protocolFee = await params.client.getPoolFeeAmount(
      params.poolAddress,
    );
    // Depositing STRK needs one allowance covering the fee AND the deposit, and
    // approve overwrites rather than adds, so the two are summed here.
    const depositsStrk =
      params.kind === 'deposit' &&
      params.tokenAddress !== undefined &&
      normalizeTokenAddress(params.tokenAddress) ===
        normalizeTokenAddress(STRK_TOKEN_ADDRESS);
    const strkAllowance = new BigNumber(protocolFee)
      .plus(depositsStrk ? (params.amount ?? 0) : 0)
      .toFixed(0);

    const calls: IStarknetCall[] = [];
    // A zero allowance is a no-op call; skip it rather than paying gas for it.
    if (new BigNumber(strkAllowance).gt(0)) {
      calls.push(
        buildErc20ApproveCall({
          tokenAddress: STRK_TOKEN_ADDRESS,
          spender: params.poolAddress,
          amount: strkAllowance,
        }),
      );
    }
    // A non-STRK deposit needs its own allowance on that token as well.
    if (params.kind === 'deposit' && params.tokenAddress && !depositsStrk) {
      calls.push(
        buildErc20ApproveCall({
          tokenAddress: params.tokenAddress,
          spender: params.poolAddress,
          amount: params.amount ?? '0',
        }),
      );
    }
    calls.push({
      contractAddress: normalizeStarknetAddress(call.contractAddress),
      entrypoint: call.entrypoint,
      calldata:
        (call.calldata as unknown[] | undefined)?.map((item) =>
          toHexFelt(item as string | number | bigint),
        ) ?? [],
    });

    const privacy: IEncodedTxStarknetPrivacy = {
      poolAddress: params.poolAddress,
      kind: params.kind,
      proofFacts: proof.proofFacts.map((fact) => toHexFelt(fact)),
      proof: proof.data,
      provingBlockId: params.provingBlockId,
      builtAt: Date.now(),
      ...(params.tokenAddress ? { tokenAddress: params.tokenAddress } : {}),
      ...(params.amount ? { amount: params.amount } : {}),
      ...(params.recipient ? { recipient: params.recipient } : {}),
      protocolFee,
      ...(warnings.length ? { warnings } : {}),
    };

    const encodedTx = await params.vault.buildPrivacyEncodedTx({
      from: params.accountAddress,
      calls,
      privacy,
    });
    const unsignedTx = await params.vault.buildUnsignedTx({ encodedTx });
    return { unsignedTx, warnings };
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
    if (registered && registered === ctx.viewing.publicKeyX) {
      await simpleDb.starknetPrivacy.patchRecord({
        ...p,
        poolAddress: ctx.poolAddress,
        patch: {
          optInStatus: EStrk20OptInStatus.Registered,
          registeredPublicKey: registered,
        },
      });
      return { alreadyRegistered: true };
    }
    if (registered) {
      await simpleDb.starknetPrivacy.patchRecord({
        ...p,
        poolAddress: ctx.poolAddress,
        patch: {
          optInStatus: EStrk20OptInStatus.Mismatch,
          registeredPublicKey: registered,
        },
      });
      this.dropCachedViewingKey({ ...p, poolAddress: ctx.poolAddress });
      throw strk20Error(EStrk20ErrorCode.KeyMismatch);
    }

    if (p.resumeOnly) throw strk20Error(EStrk20ErrorCode.Unavailable);

    const sequencing = await this.assertBuildable({
      ...p,
      poolAddress: ctx.poolAddress,
      client: ctx.client,
    });
    const transfers = await ctx.buildTransfers();
    const invocation = await transfers
      .build(STATELESS_EXECUTE_OPTIONS)
      .register()
      .createProofInvocation();
    const result = await transfers.executeWithInvocation(
      invocation,
      sequencing.provingBlockId,
    );
    ctx.assertSession();

    const { unsignedTx } = await this.wrapCallAndProof({
      ...p,
      poolAddress: ctx.poolAddress,
      client: ctx.client,
      vault: ctx.vault,
      accountAddress: ctx.account.address,
      kind: 'register',
      result,
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
    const transfers = await ctx.buildTransfers();
    // A finalized number, so the amounts and the block they are true at agree.
    const blockNumber = await ctx.client.getBlockNumber();
    ctx.assertSession();
    const discovered = await transfers.discoverNotes({
      tokens: p.tokenAddresses?.map((token) => BigInt(token)),
      blockIdentifier: blockNumber,
    });
    ctx.assertSession();

    const { normalizeTokenAddress, toHexFelt } = await loadStarknetUtils();
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
    const state = await this.getAccountPrivacyState(p);
    if (generation !== this.viewingKeyGeneration) {
      throw strk20Error(EStrk20ErrorCode.Locked);
    }
    if (state.optInStatus !== EStrk20OptInStatus.Registered) {
      throw strk20Error(EStrk20ErrorCode.Unavailable);
    }
    const ctx = await this.getPrivacyContext({
      ...p,
      allowPrompt,
      purpose,
    });
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
   * `Register` means the recipient has never opted in, which the send form must
   * treat as a blocking error; the other two only mean the first transfer
   * carries extra setup actions, which `autoSetup` adds.
   */
  @backgroundMethod()
  async getRecipientRequirement(
    p: IStrk20AccountKey & { recipient: string; tokenAddress: string },
  ): Promise<EStrk20SetupRequirement> {
    const ctx = await this.getRegisteredPrivacyContext(p, 'read', false);
    const transfers = await ctx.buildTransfers();
    const { normalizeStarknetAddress, normalizeTokenAddress } =
      await loadStarknetUtils();
    const requirement = await transfers.discoverRequirement(
      normalizeStarknetAddress(p.recipient),
      normalizeTokenAddress(p.tokenAddress),
    );
    return requirement as unknown as EStrk20SetupRequirement;
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
    hasMore: boolean;
    isEnabled?: boolean;
    cursor?: IStrk20HistoryCursor;
  }> {
    if (
      (await this.getAccountPrivacyState(p)).optInStatus !==
      EStrk20OptInStatus.Registered
    ) {
      return { txs: [], hasMore: false, isEnabled: false };
    }
    const ctx = await this.getRegisteredPrivacyContext(p, 'read', false);
    const page = await fetchStrk20HistoryPage({
      discoveryUrl: ctx.config.discoveryUrl,
      poolAddress: ctx.poolAddress,
      accountAddress: ctx.account.address,
      viewingKey: ctx.viewing.viewingKey,
      cursor: p.cursor,
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
    const txs = await Promise.all(
      page.transactions.map((transaction) =>
        this.buildPrivateHistoryTx({
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
    ctx.assertSession();
    return {
      txs: sortHistoryTxsByTime({ txs: [...byHash.values()] }),
      hasMore: !page.cursor.historyComplete,
      isEnabled: true,
      cursor: serializeHistoryCursor(page.cursor),
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
      await loadStarknetUtils();
    return Promise.all(
      txs.map(async (tx) => {
        const intent = (tx.decodedTx.extraInfo as IDecodedTxExtraStarknet)
          .privacy;
        if (!intent?.amount) return tx;
        let status = tx.decodedTx.status;
        let totalFeeInNative = tx.decodedTx.totalFeeInNative;
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
            totalFeeInNative =
              getReceiptFeeInNative(
                receipt,
                params.ctx.network.feeMeta.decimals,
              ) ?? totalFeeInNative;
            await serviceHistory.updateLocalHistoryConfirmedTxStatus({
              ...query,
              txid: tx.decodedTx.txid,
              status,
            });
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
            decodedTx: {
              ...tx.decodedTx,
              status,
              totalFeeInNative,
              totalFeeFiatValue: scaleFeeFiatValueToNativeFee({
                feeFiatValue: tx.decodedTx.totalFeeFiatValue,
                feeInNative: tx.decodedTx.totalFeeInNative,
                nextFeeInNative: totalFeeInNative,
              }),
            },
          },
          selectedPoolId: PRIVATE_HISTORY_POOL_ID,
        });
      }),
    );
  }

  /**
   * Token-specific movements with known counterparties. Metadata comes from
   * the token service. Keep the actual block when no timestamp is provided;
   * unknown fees stay unknown.
   */
  private async buildPrivateHistoryTx(params: {
    networkId: string;
    accountId: string;
    accountAddress: string;
    poolAddress: string;
    transaction: IStrk20HistoryTransactionLike;
    tokenAddress: string;
    getTokenInfo: () => Promise<IToken | undefined>;
  }): Promise<IAccountHistoryTx | undefined> {
    const { transaction } = params;
    const { normalizeStarknetAddress, toHexFelt } = await loadStarknetUtils();
    const txid = toHexFelt(transaction.transactionHash);
    const movements = (
      await getStrk20HistoryTransfers(
        transaction,
        BigInt(params.accountAddress),
        BigInt(params.poolAddress),
      )
    ).filter((item) => item.token === BigInt(params.tokenAddress));
    if (!movements.length) return undefined;
    const kind: EStrk20PrivateTxKind = movements.every(
      (item) => item.kind === movements[0].kind,
    )
      ? movements[0].kind
      : 'transfer';
    const vault = await this.getStarknetVault(params);
    const token = await params.getTokenInfo();
    if (!token || token.decimals === undefined)
      throw strk20Error(EStrk20ErrorCode.History);
    const action = await vault.buildTxTransferAssetAction({
      from: normalizeStarknetAddress(toHexFelt(movements[0].from)),
      to: normalizeStarknetAddress(toHexFelt(movements[0].to)),
      transfers: movements.map((item) => ({
        from: normalizeStarknetAddress(toHexFelt(item.from)),
        to: normalizeStarknetAddress(toHexFelt(item.to)),
        tokenIdOnNetwork: params.tokenAddress,
        amount: new BigNumber(item.amount.toString())
          .shiftedBy(-token.decimals)
          .toFixed(),
        icon: token.logoURI ?? '',
        name: token.name,
        symbol: token.symbol,
        isNFT: false,
        isNative:
          token.isNative ??
          BigInt(params.tokenAddress) === BigInt(STRK_TOKEN_ADDRESS),
      })),
    });

    const delta = movements
      .reduce((balance, movement) => {
        if (movement.kind === 'deposit')
          return balance.plus(movement.amount.toString());
        if (movement.kind === 'withdraw')
          return balance.minus(movement.amount.toString());
        return balance
          .plus(
            (movement.to === BigInt(params.accountAddress)
              ? movement.amount
              : BigInt(0)
            ).toString(),
          )
          .minus(
            (movement.from === BigInt(params.accountAddress)
              ? movement.amount
              : BigInt(0)
            ).toString(),
          );
      }, new BigNumber(0))
      .shiftedBy(-token.decimals)
      .toFixed();
    const tx: IAccountHistoryTx = {
      id: txid,
      isLocalCreated: false,
      privacyChainHistorySide: 'private',
      privacyChainHistoryPoolIds: [PRIVATE_HISTORY_POOL_ID],
      privacyChainHistoryPoolDeltas: { [PRIVATE_HISTORY_POOL_ID]: delta },
      privacyChainHistoryFeePoolId: 0,
      decodedTx: {
        txid,
        owner: params.accountAddress,
        signer: normalizeStarknetAddress(toHexFelt(movements[0].from)),
        nonce: 0,
        actions: [action],
        status: EDecodedTxStatus.Confirmed,
        networkId: params.networkId,
        accountId: params.accountId,
        extraInfo: {
          privacy: {
            kind,
            poolAddress: normalizeStarknetAddress(params.poolAddress),
          },
        } as IDecodedTxExtraStarknet,
        block: transaction.blockNumber,
      },
    };
    return projectPrivacyChainHistoryTxToPool({
      tx,
      selectedPoolId: PRIVATE_HISTORY_POOL_ID,
    });
  }

  /**
   * Amounts are base-unit integer strings, matching
   * `IStrk20PrivateBalances.byToken`; nothing here re-scales by decimals.
   */
  @backgroundMethod()
  async buildPrivateTransferTx(
    p: IStrk20AccountKey & {
      kind: IStrk20TransferKind;
      tokenAddress: string;
      amount: string;
      recipient?: string;
    },
  ): Promise<{ unsignedTx: IUnsignedTxPro; warnings: IStrk20Warning[] }> {
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
    const amountBase = parseStrk20BaseAmount(p.amount);
    if (amountBase === '0') throw strk20Error(EStrk20ErrorCode.InvalidAmount);
    const ctx = await this.getRegisteredPrivacyContext(p);
    const sequencing = await this.assertBuildable({
      ...p,
      poolAddress: ctx.poolAddress,
      client: ctx.client,
    });

    const amount = BigInt(amountBase);
    const { normalizeStarknetAddress, normalizeTokenAddress } =
      await loadStarknetUtils();
    const token = normalizeTokenAddress(p.tokenAddress);
    const transfers = await ctx.buildTransfers();
    const tokenOps = transfers
      .build(STATELESS_EXECUTE_OPTIONS)
      .with(token)
      .surplusTo(ctx.account.address);

    if (p.kind === 'deposit') {
      tokenOps.deposit({ amount });
    } else if (p.kind === 'withdraw') {
      tokenOps.withdraw(
        p.recipient
          ? { recipient: normalizeStarknetAddress(p.recipient), amount }
          : { amount },
      );
    } else {
      tokenOps.transfer({
        recipient: normalizeStarknetAddress(p.recipient ?? ''),
        amount,
      });
    }

    const invocation = await tokenOps.createProofInvocation();
    const result = await transfers.executeWithInvocation(
      invocation,
      sequencing.provingBlockId,
    );
    ctx.assertSession();

    const built = await this.wrapCallAndProof({
      networkId: p.networkId,
      accountId: p.accountId,
      poolAddress: ctx.poolAddress,
      client: ctx.client,
      vault: ctx.vault,
      accountAddress: ctx.account.address,
      kind: p.kind,
      result,
      provingBlockId: sequencing.provingBlockId,
      tokenAddress: token,
      amount: amountBase,
      recipient: p.recipient,
    });
    ctx.assertSession();
    return built;
  }
}

export default ServiceStarknetPrivacy;
