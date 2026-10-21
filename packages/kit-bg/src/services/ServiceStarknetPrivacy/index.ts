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
import { ETranslationsMock } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';
import {
  EStrk20OptInStatus,
  type EStrk20PrivateTxKind,
  EStrk20SequencingStatus,
  type EStrk20SetupRequirement,
  type IStrk20AccountKey,
  type IStrk20AccountPrivacyState,
  type IStrk20HistoryCursor,
  type IStrk20OhttpConfig,
  type IStrk20PrivacyConfigEnvelope,
  type IStrk20PrivacyNetworkConfig,
  type IStrk20PrivateBalances,
  type IStrk20SequencingState,
  type IStrk20TransferKind,
  type IStrk20Warning,
} from '@onekeyhq/shared/types/starknetPrivacy';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import simpleDb from '../../dbs/simple/simpleDb';
import { vaultFactory } from '../../vaults/factory';
import {
  STARKNET_BLOCK_TIME_SECONDS,
  STRK20_PRIVACY_FALLBACK_CONFIG,
  STRK_TOKEN_ADDRESS,
} from '../../vaults/impls/starknet/sdkStarknet/consts';
import {
  buildErc20ApproveCall,
  normalizeStarknetAddress,
  normalizeTokenAddress,
  toHexFelt,
} from '../../vaults/impls/starknet/utils';
import ServiceBase from '../ServiceBase';

import {
  buildOhttpOption,
  createStrk20Signer,
  createStrk20Transfers,
  fetchStrk20HistoryPage,
  resolvePrivateHistoryKind,
  serializeHistoryCursor,
} from './strk20Sdk';

import type ClientStarknet from '../../vaults/impls/starknet/sdkStarknet/ClientStarknet';
import type StarknetVault from '../../vaults/impls/starknet/Vault';
import type {
  IKeyringStrk20ProofInvocationSigner,
  IKeyringStrk20ViewingKeyDeriver,
  IVaultSettingsPrivacyPool,
} from '../../vaults/types';

/**
 * Backend route for the STRK20 endpoint config. **This route does not exist
 * yet** — discovery, proving and the OHTTP gateway are still gated behind
 * StarkWare's access request, so every fetch currently fails and the bundled
 * `enabled: false` fallback is what the app runs on. Keep the constant so the
 * wiring is reviewable, and do not invent a placeholder host.
 */
const STRK20_PRIVACY_CONFIG_API_PATH = '/utility/v1/starknet/privacy-config';

const CONFIG_STALE_MS = timerUtils.getTimeDurationMs({ hour: 1 });

/** Matches the PRF master key cache: a derived secret on a short fixed TTL. */
const VIEWING_KEY_CACHE_DURATION_MS = 5 * 60 * 1000;

/**
 * `new OneKeyLocalError({ key })` alone is not translated — it surfaces the raw
 * key string — so background errors have to carry a formatted message.
 */
function strk20Error(id: ETranslationsMock): OneKeyLocalError {
  return new OneKeyLocalError({
    key: id,
    message: appLocale.intl.formatMessage({ id }),
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

/** The parts of the SDK's `HistoryTransaction` this service reads. */
type IStrk20HistoryTransactionLike = {
  blockNumber: number;
  transactionHash: bigint;
  notes: unknown[];
  deposits: unknown[];
  withdrawals: unknown[];
  openNoteDeposits: unknown[];
  registration?: unknown;
};

type IViewingKeyCacheEntry = {
  viewingKey: string;
  publicKeyX: string;
};

/** Cache entries expire individually; one shared timer only sweeps. */
type IViewingKeyCacheRecord = IViewingKeyCacheEntry & { expiresAt: number };

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
    throw strk20Error(ETranslationsMock.starknet_privacy_error_invalid_amount);
  }
  return value.toFixed(0);
}

function isHttpsUrl(url: string): boolean {
  return /^https:\/\//i.test(url);
}

/** 0x-optional, even-length hex. Anything else is a malformed envelope. */
function isEvenLengthHex(value: string): boolean {
  const body = value.replace(/^0x/i, '');
  return body.length > 0 && body.length % 2 === 0 && /^[0-9a-f]+$/i.test(body);
}

/**
 * Validated at parse time on purpose: a bad pinned key config used to surface
 * only when the first request was encrypted, where mapStrk20Error could do
 * nothing but call it unknown. Throwing here keeps the last good envelope.
 */
function parseStrk20OhttpConfig(
  networkId: string,
  raw: unknown,
): IStrk20OhttpConfig | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  const ohttp = raw as Partial<IStrk20OhttpConfig>;
  const invalid = (reason: string) =>
    new OneKeyLocalError(
      `Invalid STRK20 privacy ohttp config for ${networkId}: ${reason}`,
    );
  if (typeof ohttp !== 'object' || typeof ohttp.enabled !== 'boolean') {
    throw invalid('enabled must be a boolean');
  }
  if (ohttp.relayUrl !== undefined) {
    if (typeof ohttp.relayUrl !== 'string' || !isHttpsUrl(ohttp.relayUrl)) {
      throw invalid('relayUrl must be an https url');
    }
  }
  if (ohttp.publicKeyConfig !== undefined) {
    if (
      typeof ohttp.publicKeyConfig !== 'string' ||
      !isEvenLengthHex(ohttp.publicKeyConfig)
    ) {
      throw invalid('publicKeyConfig must be even-length hex');
    }
  }
  return {
    enabled: ohttp.enabled,
    ...(ohttp.relayUrl ? { relayUrl: ohttp.relayUrl } : {}),
    ...(ohttp.publicKeyConfig
      ? { publicKeyConfig: ohttp.publicKeyConfig }
      : {}),
  };
}

/**
 * Strict parser, IP-table style: anything malformed throws so the last good
 * envelope is kept rather than a half-populated config being trusted. A config
 * that claims `enabled` without both endpoints is treated as malformed, because
 * enabling the feature with nowhere to send a proof is worse than staying off.
 */
export function parseStrk20ConfigEnvelope(
  input: unknown,
): IStrk20PrivacyConfigEnvelope {
  const envelope = input as Partial<IStrk20PrivacyConfigEnvelope> | undefined;
  if (
    !envelope ||
    typeof envelope.version !== 'number' ||
    typeof envelope.updatedAt !== 'number' ||
    !envelope.configs ||
    typeof envelope.configs !== 'object'
  ) {
    throw new OneKeyLocalError('Invalid STRK20 privacy config envelope');
  }
  const configs: Record<string, IStrk20PrivacyNetworkConfig> = {};
  for (const [networkId, raw] of Object.entries(envelope.configs)) {
    const config = raw as Partial<IStrk20PrivacyNetworkConfig> | undefined;
    if (
      !config ||
      typeof config.enabled !== 'boolean' ||
      typeof config.poolAddress !== 'string' ||
      !config.poolAddress ||
      typeof config.discoveryUrl !== 'string' ||
      typeof config.provingUrl !== 'string' ||
      typeof config.auditorPublicKey !== 'string' ||
      typeof config.minRpcSpecVersion !== 'string'
    ) {
      throw new OneKeyLocalError(
        `Invalid STRK20 privacy config for ${networkId}`,
      );
    }
    if (config.enabled && (!config.discoveryUrl || !config.provingUrl)) {
      throw new OneKeyLocalError(
        `STRK20 privacy config for ${networkId} is enabled without endpoints`,
      );
    }
    // Plaintext http would put the viewing key on the wire, and the SDK's own
    // note on OhttpClient says https is required in production: without it an
    // active attacker can swap the OHTTP key config.
    if (
      config.enabled &&
      (!isHttpsUrl(config.discoveryUrl) || !isHttpsUrl(config.provingUrl))
    ) {
      throw new OneKeyLocalError(
        `STRK20 privacy config for ${networkId} has a non-https endpoint`,
      );
    }
    if (
      config.provingKind !== undefined &&
      config.provingKind !== 'jsonRpc' &&
      config.provingKind !== 'starkscan'
    ) {
      throw new OneKeyLocalError(
        `STRK20 privacy config for ${networkId} has an unknown provingKind`,
      );
    }
    if (
      config.provingApiKey !== undefined &&
      typeof config.provingApiKey !== 'string'
    ) {
      throw new OneKeyLocalError(
        `STRK20 privacy config for ${networkId} has an invalid provingApiKey`,
      );
    }
    if (
      config.enabled &&
      config.provingKind === 'starkscan' &&
      !config.provingApiKey
    ) {
      throw new OneKeyLocalError(
        `STRK20 privacy config for ${networkId} uses Starkscan proving without an API key`,
      );
    }
    // Starkscan has no OHTTP, so its proving leg is plain TLS; OHTTP below
    // still protects discovery, which carries the viewing key.
    const ohttp = parseStrk20OhttpConfig(networkId, config.ohttp);
    // A pinned key config is the whole point of enabling OHTTP: without one the
    // SDK trusts the first /ohttp-keys response it sees.
    if (config.enabled && !ohttp?.enabled) {
      throw new OneKeyLocalError(
        `STRK20 privacy config for ${networkId} is enabled without OHTTP`,
      );
    }
    if (config.enabled && !ohttp?.publicKeyConfig) {
      throw new OneKeyLocalError(
        `STRK20 privacy config for ${networkId} is enabled without a pinned OHTTP key config`,
      );
    }
    configs[networkId] = {
      ...config,
      networkId,
      ...(ohttp ? { ohttp } : {}),
    } as IStrk20PrivacyNetworkConfig;
  }
  return {
    version: envelope.version,
    updatedAt: envelope.updatedAt,
    configs,
  };
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

  private viewingKeyCacheTimeout: ReturnType<typeof setTimeout> | null = null;

  // ---------------------------------------------------------------- config

  private _fetchRemoteConfig = memoizee(
    async (): Promise<IStrk20PrivacyConfigEnvelope> => {
      const client = await this.getClient(EServiceEndpointEnum.Utility);
      const response = await client.get<{ data: unknown }>(
        STRK20_PRIVACY_CONFIG_API_PATH,
      );
      const envelope = parseStrk20ConfigEnvelope(response.data?.data);
      await simpleDb.starknetPrivacyConfig.saveEnvelope({
        envelope,
        syncedAt: Date.now(),
      });
      return envelope;
    },
    {
      promise: true,
      maxAge: CONFIG_STALE_MS,
    },
  );

  /**
   * Stale-while-revalidate: the stored envelope answers immediately and a stale
   * one triggers a background refresh. A failed fetch is swallowed on purpose —
   * falling back to the bundled disabled config is the safe direction.
   */
  @backgroundMethod()
  async getPrivacyConfig(p: {
    networkId: string;
  }): Promise<IStrk20PrivacyNetworkConfig | undefined> {
    const { envelope, syncedAt } =
      await simpleDb.starknetPrivacyConfig.getEnvelope();

    const isStale = !syncedAt || Date.now() - syncedAt > CONFIG_STALE_MS;
    if (isStale) {
      void this._fetchRemoteConfig().catch(() => {
        // endpoint access is still pending (see the constant above)
      });
    }

    return (
      envelope?.configs?.[p.networkId] ??
      STRK20_PRIVACY_FALLBACK_CONFIG[p.networkId]
    );
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
   * the account-level gates apply too: a watching account holds no key, and an
   * undeployed account has no contract for the pool's is_valid_signature call.
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
    if (
      !config?.enabled ||
      !config.discoveryUrl ||
      !config.provingUrl ||
      !config.poolAddress
    ) {
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
    if (p.accountId) {
      const address = await vault.getAccountAddress();
      if (!(await client.isAccountDeployed(address))) {
        return false;
      }
    }
    return true;
  }

  /** Watching accounts cannot register: there is no key to derive from. */
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
      throw strk20Error(ETranslationsMock.starknet_privacy_error_unavailable);
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
    if (stored) {
      return stored;
    }
    return this.buildEmptyState({ ...p, poolAddress });
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
    this.viewingKeyCache.clear();
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
    this.viewingKeyCache.delete(this.buildCacheKey(p));
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
   * Resolves the viewing key for bg-internal use only; it is never returned
   * from a `@backgroundMethod()`. `allowPrompt` is false on every background
   * refresh path, so a periodic sync can never pop a password dialog — it
   * throws a typed "locked" error the UI renders as a hint instead.
   */
  private async ensureViewingKey(p: {
    networkId: string;
    accountId: string;
    poolAddress: string;
    allowPrompt: boolean;
    /** Shared with the signer so one prompt covers derivation and signing. */
    resolvePassword?: () => Promise<string>;
  }): Promise<IViewingKeyCacheEntry> {
    const cached = this.readCachedViewingKey(p);
    if (cached) {
      return cached;
    }
    if (!p.allowPrompt) {
      throw strk20Error(ETranslationsMock.starknet_privacy_error_locked);
    }
    if (!this.canAccountUsePrivacy(p.accountId)) {
      throw strk20Error(ETranslationsMock.starknet_privacy_error_unavailable);
    }

    const password = p.resolvePassword
      ? await p.resolvePassword()
      : (
          await this.backgroundApi.servicePassword.promptPasswordVerifyByAccount(
            {
              accountId: p.accountId,
              reason: EReasonForNeedPassword.Security,
            },
          )
        ).password;

    const vault = await this.getStarknetVault(p);
    const keyring = vault.keyring as unknown as IKeyringStrk20ViewingKeyDeriver;
    const [account, network] = await Promise.all([
      vault.getAccount(),
      vault.getNetwork(),
    ]);
    const derived = await keyring.deriveStrk20ViewingKey({
      password,
      chainId: network.chainId,
      accountAddress: account.address,
      poolAddress: p.poolAddress,
    });

    const entry: IViewingKeyCacheEntry = {
      viewingKey: derived.viewingKey,
      publicKeyX: derived.publicKeyX,
    };
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
    const lastTxBlockNumber = state.lastTxBlockNumber;

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
    return {
      status: EStrk20SequencingStatus.Ready,
      latestBlock,
      lastTxBlockNumber,
      blocksRemaining: 0,
      estimatedSecondsRemaining: 0,
      provingBlockId: Math.max(0, latestBlock - (cooldown - 1)),
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
  }) {
    const config = await this.getPrivacyConfig({ networkId: p.networkId });
    if (
      !config?.enabled ||
      !config.poolAddress ||
      !config.discoveryUrl ||
      !config.provingUrl
    ) {
      throw strk20Error(ETranslationsMock.starknet_privacy_error_unavailable);
    }
    const poolAddress = config.poolAddress;
    const vault = await this.getStarknetVault(p);
    const client = await vault.getClient();
    const [account, network] = await Promise.all([
      vault.getAccount(),
      vault.getNetwork(),
    ]);

    let cachedPassword: string | undefined;
    const resolvePassword = async (): Promise<string> => {
      if (cachedPassword) {
        return cachedPassword;
      }
      if (!p.allowPrompt) {
        throw strk20Error(ETranslationsMock.starknet_privacy_error_locked);
      }
      const { password } =
        await this.backgroundApi.servicePassword.promptPasswordVerifyByAccount({
          accountId: p.accountId,
          reason: EReasonForNeedPassword.Security,
        });
      cachedPassword = password;
      return password;
    };

    const viewing = await this.ensureViewingKey({
      networkId: p.networkId,
      accountId: p.accountId,
      poolAddress,
      allowPrompt: p.allowPrompt,
      resolvePassword,
    });

    const buildTransfers = async () =>
      createStrk20Transfers({
        accountAddress: account.address,
        signer: createStrk20Signer({
          keyring:
            vault.keyring as unknown as IKeyringStrk20ProofInvocationSigner,
          resolvePassword,
          chainId: network.chainId,
          poolAddress,
        }),
        viewingKey: viewing.viewingKey,
        poolAddress,
        chainId: network.chainId,
        discoveryUrl: config.discoveryUrl,
        provingUrl: config.provingUrl,
        provingKind: config.provingKind,
        provingApiKey: config.provingApiKey,
        nodeUrl: client.rpcUrl || undefined,
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
      throw strk20Error(ETranslationsMock.starknet_privacy_error_pool_paused);
    }
    const sequencing = await this.getSequencingState({
      networkId: p.networkId,
      accountId: p.accountId,
    });
    if (sequencing.status !== EStrk20SequencingStatus.Ready) {
      throw strk20Error(ETranslationsMock.starknet_privacy_status_waiting);
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
   * register never restarts the consent flow. `mismatch` is terminal: the pool's
   * viewing key is write-once, so a differing on-chain key must never be
   * overwritten with a second registration.
   */
  @backgroundMethod()
  async buildRegisterTx(p: IStrk20AccountKey): Promise<IUnsignedTxPro> {
    const ctx = await this.getPrivacyContext({ ...p, allowPrompt: true });
    const registered = await ctx.client.getPoolRegisteredPublicKey({
      poolAddress: ctx.poolAddress,
      accountAddress: ctx.account.address,
    });
    if (registered && registered !== ctx.viewing.publicKeyX) {
      await simpleDb.starknetPrivacy.patchRecord({
        ...p,
        poolAddress: ctx.poolAddress,
        patch: {
          optInStatus: EStrk20OptInStatus.Mismatch,
          registeredPublicKey: registered,
        },
      });
      throw strk20Error(ETranslationsMock.starknet_privacy_error_key_mismatch);
    }

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
    return unsignedTx;
  }

  /**
   * Stateless by design: `autoDiscover: 'refresh'` on every read and no
   * persisted note registry, so nothing local can go stale against the chain.
   * Never prompts — a background refresh throws the typed "locked" error when
   * the viewing key is not cached.
   */
  @backgroundMethod()
  async refreshPrivateBalances(
    p: IStrk20AccountKey & { tokenAddresses?: string[] },
  ): Promise<IStrk20PrivateBalances> {
    const ctx = await this.getPrivacyContext({ ...p, allowPrompt: false });
    const transfers = await ctx.buildTransfers();
    // A finalized number, so the amounts and the block they are true at agree.
    const blockNumber = await ctx.client.getBlockNumber();
    const discovered = await transfers.discoverNotes({
      tokens: p.tokenAddresses?.map((token) => BigInt(token)),
      blockIdentifier: blockNumber,
    });

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

    await simpleDb.starknetPrivacy.patchRecord({
      ...p,
      poolAddress: ctx.poolAddress,
      patch: { lastRefreshAt: Date.now() },
    });
    return { byToken, noteCount, blockNumber };
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
    const ctx = await this.getPrivacyContext({ ...p, allowPrompt: false });
    const transfers = await ctx.buildTransfers();
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
    p: IStrk20AccountKey & { cursor?: IStrk20HistoryCursor },
  ): Promise<{
    txs: IAccountHistoryTx[];
    hasMore: boolean;
    cursor?: IStrk20HistoryCursor;
  }> {
    const ctx = await this.getPrivacyContext({ ...p, allowPrompt: false });
    const page = await fetchStrk20HistoryPage({
      discoveryUrl: ctx.config.discoveryUrl,
      poolAddress: ctx.poolAddress,
      accountAddress: ctx.account.address,
      viewingKey: ctx.viewing.viewingKey,
      cursor: p.cursor,
      ohttp: buildOhttpOption(ctx.config.ohttp),
    });

    const txs = await Promise.all(
      page.transactions.map((transaction) =>
        this.buildPrivateHistoryTx({
          networkId: p.networkId,
          accountId: p.accountId,
          accountAddress: ctx.account.address,
          poolAddress: ctx.poolAddress,
          transaction,
        }),
      ),
    );
    return {
      txs,
      hasMore: !page.cursor.historyComplete,
      cursor: serializeHistoryCursor(page.cursor),
    };
  }

  /**
   * One row per protocol transaction. Amounts stay in base units and tokens are
   * left as addresses: ServiceHistory's own token decoration fills the rest, and
   * inventing metadata here would diverge from the transparent rows.
   */
  private async buildPrivateHistoryTx(params: {
    networkId: string;
    accountId: string;
    accountAddress: string;
    poolAddress: string;
    transaction: IStrk20HistoryTransactionLike;
  }): Promise<IAccountHistoryTx> {
    const { transaction } = params;
    const txid = toHexFelt(transaction.transactionHash);
    const kind: EStrk20PrivateTxKind = resolvePrivateHistoryKind(transaction);
    const vault = await this.getStarknetVault(params);
    const action = await vault.buildTxTransferAssetAction({
      from: params.accountAddress,
      to: normalizeStarknetAddress(params.poolAddress),
      transfers: [],
    });

    return {
      id: txid,
      isLocalCreated: false,
      decodedTx: {
        txid,
        owner: params.accountAddress,
        signer: params.accountAddress,
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
        createdAt: undefined,
        updatedAt: undefined,
        totalFeeInNative: '0',
      },
    };
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
    if (p.kind === 'transfer' && !p.recipient) {
      throw strk20Error(
        ETranslationsMock.starknet_privacy_error_recipient_not_registered,
      );
    }
    // Normalized once and shared by both consumers. Rounding twice — here for
    // the SDK and again inside wrapCallAndProof for the approve — can differ by
    // one base unit on a non-integer input, and apply_actions reverts when the
    // allowance is short by any amount.
    const amountBase = parseStrk20BaseAmount(p.amount);
    const ctx = await this.getPrivacyContext({ ...p, allowPrompt: true });
    const sequencing = await this.assertBuildable({
      ...p,
      poolAddress: ctx.poolAddress,
      client: ctx.client,
    });

    const amount = BigInt(amountBase);
    const token = normalizeTokenAddress(p.tokenAddress);
    const transfers = await ctx.buildTransfers();
    const tokenOps = transfers.build(STATELESS_EXECUTE_OPTIONS).with(token);

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

    return this.wrapCallAndProof({
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
  }
}

export default ServiceStarknetPrivacy;
