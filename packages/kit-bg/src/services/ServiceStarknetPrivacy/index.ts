import BigNumber from 'bignumber.js';

import { normalizeStarknetChainId } from '@onekeyhq/core/src/chains/starknet/sdkStarknet/chainId';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { strk20Error } from '@onekeyhq/shared/src/utils/strk20ErrorUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import type { IProxyRequest } from '@onekeyhq/shared/types/proxy';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';
import {
  EStrk20ErrorCode,
  EStrk20OptInStatus,
  type EStrk20PrivateTxKind,
  EStrk20SequencingStatus,
  type IStrk20AccountKey,
  type IStrk20AccountPrivacySnapshot,
  type IStrk20AccountPrivacyState,
  type IStrk20HistoryCursor,
  type IStrk20PrivacyNetworkConfig,
  type IStrk20SequencingState,
  type IStrk20TransferKind,
  type IStrk20Warning,
} from '@onekeyhq/shared/types/starknetPrivacy';

import ServiceBase from '../ServiceBase';

import { PrivacyBalanceStore } from './PrivacyBalanceStore';
import { PrivacyHistoryStore } from './PrivacyHistoryStore';
import { PrivacyLifecycleStore } from './PrivacyLifecycleStore';
import { PrivacyTxBuilder } from './PrivacyTxBuilder';
import { buildPrivacyCacheKey } from './types';
import { ViewingKeyManager } from './ViewingKeyManager';

import type {
  IPrivateBalanceQuery,
  IPrivateBalanceSnapshot,
  IStarknetPrivacyContext,
  IStarknetPrivacyCredentials,
} from './types';
import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IKeyringStrk20ProofInvocationSigner } from '../../vaults/impls/starknet/privacyKeyringTypes';
import type ClientStarknet from '../../vaults/impls/starknet/sdkStarknet/ClientStarknet';
import type { IStrk20ProverProxyItem } from '../../vaults/impls/starknet/strk20Adapter';
import type StarknetVault from '../../vaults/impls/starknet/Vault';
import type { IVaultSettingsPrivacyPool } from '../../vaults/types';

/**
 * STRK20 private transfers on Starknet (thin background Facade).
 *
 * bg-only by construction: viewing keys live inside ViewingKeyManager and never
 * cross a `@backgroundMethod()` boundary. The service never signs and never
 * broadcasts — signing stays in the keyring, submission in the vault.
 */
@backgroundClass()
class ServiceStarknetPrivacy extends ServiceBase {
  private readonly viewingKeys: ViewingKeyManager;

  private readonly lifecycle: PrivacyLifecycleStore;

  private readonly balances: PrivacyBalanceStore;

  private readonly history: PrivacyHistoryStore;

  private readonly txBuilder: PrivacyTxBuilder;

  constructor({ backgroundApi }: { backgroundApi: IBackgroundApi }) {
    super({ backgroundApi });

    this.balances = new PrivacyBalanceStore({
      getGeneration: () => this.viewingKeys.getGeneration(),
      resolvePoolAddress: (networkId) => this.resolvePoolAddress(networkId),
      isDisabledByServer: (networkId) => this.isDisabledByServer(networkId),
      getAccountPrivacyState: (p) => this.getAccountPrivacyState(p),
      getRegisteredPrivacyContext: (p, purpose, allowPrompt) =>
        this.getRegisteredPrivacyContext(p, purpose, allowPrompt),
    });

    this.history = new PrivacyHistoryStore({
      backgroundApi,
      getGeneration: () => this.viewingKeys.getGeneration(),
      getKeyGeneration: (scopeKey) =>
        this.viewingKeys.getKeyGeneration(scopeKey),
      getRegisteredPrivacyContext: (p, purpose, allowPrompt) =>
        this.getRegisteredPrivacyContext(p, purpose, allowPrompt),
    });

    this.viewingKeys = new ViewingKeyManager({
      backgroundApi,
      getStarknetVault: (p) => this.getStarknetVault(p),
      isDisabledByServer: (networkId) => this.isDisabledByServer(networkId),
      onClearAll: () => {
        this.balances.clear();
        this.history.clear();
      },
      onDropScope: (scopeKey) => {
        this.balances.dropScope(scopeKey);
        this.history.dropScope(scopeKey);
      },
    });

    this.lifecycle = new PrivacyLifecycleStore({
      getPrivacyConfig: (p) => this.getPrivacyConfig(p),
      getPrivacyPoolSettings: (networkId) =>
        this.getPrivacyPoolSettings(networkId),
      resolvePoolAddress: (networkId) => this.resolvePoolAddress(networkId),
      isDisabledByServer: (networkId) => this.isDisabledByServer(networkId),
      getStarknetVault: (p) => this.getStarknetVault(p),
      isKeyLoaded: (p) => this.viewingKeys.isKeyLoaded(p),
      dropCachedViewingKey: (p) => this.viewingKeys.dropScope(p),
    });

    this.txBuilder = new PrivacyTxBuilder({
      resolvePoolAddress: (networkId) => this.resolvePoolAddress(networkId),
      isDisabledByServer: (networkId) => this.isDisabledByServer(networkId),
      getStarknetVault: (p) => this.getStarknetVault(p),
      getAccountPrivacyState: (p) => this.getAccountPrivacyState(p),
      getSequencingState: (p) => this.getSequencingState(p),
      isRecipientRegistered: (p) => this.isRecipientRegistered(p),
      getPrivacyContext: (p) => this.getPrivacyContext(p),
      getRegisteredPrivacyContext: (p, purpose, allowPrompt) =>
        this.getRegisteredPrivacyContext(p, purpose, allowPrompt),
      dropCachedViewingKey: (p) => this.viewingKeys.dropScope(p),
    });

    // The viewing key is a derived secret, so it must not outlive the account
    // it belongs to. Persisted records are swept separately by ServiceAppCleanup.
    appEventBus.on(EAppEventBusNames.AccountRemove, () => {
      void this.clearViewingKeyCache();
    });
    appEventBus.on(EAppEventBusNames.WalletRemove, () => {
      void this.clearViewingKeyCache();
    });
  }

  // ---------------------------------------------------------------- config

  @backgroundMethod()
  async getPrivacyConfig(p: {
    networkId: string;
  }): Promise<IStrk20PrivacyNetworkConfig | undefined> {
    const { STRK20_PRIVACY_CONFIG } =
      await import('../../vaults/impls/starknet/sdkStarknet/consts');
    return STRK20_PRIVACY_CONFIG[p.networkId];
  }

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

  private async resolvePoolAddress(networkId: string): Promise<string> {
    const config = await this.getPrivacyConfig({ networkId });
    if (!config?.poolAddress) {
      throw strk20Error(EStrk20ErrorCode.Unavailable);
    }
    return config.poolAddress;
  }

  private async getStarknetVault(p: {
    networkId: string;
    accountId?: string;
  }): Promise<StarknetVault> {
    const { vaultFactory } = await import('../../vaults/factory');
    const vault = p.accountId
      ? await vaultFactory.getVault({
          networkId: p.networkId,
          accountId: p.accountId,
        })
      : await vaultFactory.getChainOnlyVault({ networkId: p.networkId });
    return vault as StarknetVault;
  }

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

  // ------------------------------------------------ lifecycle & state machine

  @backgroundMethod()
  async prepareAccountActivation(
    p: IStrk20AccountKey,
  ): Promise<IUnsignedTxPro | undefined> {
    if (!(await this.isPrivacyAvailable(p))) {
      throw strk20Error(EStrk20ErrorCode.Unavailable);
    }
    const sequencing = await this.lifecycle.getSequencingState(p);
    if (sequencing.status === EStrk20SequencingStatus.Waiting) {
      throw strk20Error(EStrk20ErrorCode.Waiting, {
        estimatedSecondsRemaining: sequencing.estimatedSecondsRemaining,
      });
    }
    return (await this.getStarknetVault(p)).buildAccountActivationTx();
  }

  @backgroundMethod()
  async noteAccountActivationSubmitted(
    p: IStrk20AccountKey & { txid: string },
  ): Promise<void> {
    return this.lifecycle.noteAccountActivationSubmitted(p);
  }

  @backgroundMethod()
  async getAccountPrivacyState(
    p: IStrk20AccountKey,
  ): Promise<IStrk20AccountPrivacyState> {
    return this.lifecycle.getAccountPrivacyState(p);
  }

  @backgroundMethod()
  async getAccountPrivacySnapshot(
    p: IStrk20AccountKey,
  ): Promise<IStrk20AccountPrivacySnapshot> {
    const available = await this.isPrivacyAvailable(p);
    return this.lifecycle.getAccountPrivacySnapshot({ ...p, available });
  }

  async noteRegisterSubmitted(
    p: IStrk20AccountKey & {
      poolAddress: string;
      txid: string;
      provingBlockId?: number;
    },
  ): Promise<void> {
    return this.lifecycle.noteRegisterSubmitted(p);
  }

  async notePrivateTransferSubmitted(
    p: IStrk20AccountKey & {
      poolAddress: string;
      txid: string;
      kind: IStrk20TransferKind;
      provingBlockId?: number;
      fromRecovery?: boolean;
    },
  ): Promise<void> {
    return this.lifecycle.notePrivateTransferSubmitted(p);
  }

  async withPrivacyTxSubmitLock<T>(
    p: IStrk20AccountKey & { kind: EStrk20PrivateTxKind },
    fn: () => Promise<T>,
  ): Promise<T> {
    return this.lifecycle.withPrivacyTxSubmitLock(p, fn);
  }

  async assertPrivacyTxCanSubmit(
    p: IStrk20AccountKey & { kind: EStrk20PrivateTxKind },
  ): Promise<void> {
    return this.lifecycle.assertPrivacyTxCanSubmit(p);
  }

  @backgroundMethod()
  async recordConsent(
    p: IStrk20AccountKey & { consentAcceptedAt: number },
  ): Promise<void> {
    return this.lifecycle.recordConsent(p);
  }

  @backgroundMethod()
  async optOut(p: IStrk20AccountKey): Promise<void> {
    return this.lifecycle.optOut(p);
  }

  @backgroundMethod()
  async getSequencingState(
    p: IStrk20AccountKey,
  ): Promise<IStrk20SequencingState> {
    return this.lifecycle.getSequencingState(p);
  }

  @backgroundMethod()
  async noteAccountTouchedByTx(
    p: IStrk20AccountKey & { blockNumber: number },
  ): Promise<void> {
    return this.lifecycle.noteAccountTouchedByTx(p);
  }

  // ------------------------------------------------ viewing key lifecycle

  /** Called from ServicePassword.clearCachedPassword and on account removal. */
  @backgroundMethod()
  async clearViewingKeyCache(): Promise<void> {
    this.viewingKeys.clear();
  }

  invalidatePendingAuthorizations(): void {
    this.viewingKeys.invalidatePendingAuthorizations();
  }

  async prepareUnlockedViewingKeys(): Promise<void> {
    return this.viewingKeys.prepareUnlockedViewingKeys();
  }

  // ------------------------------------------------ balances, history, builds

  @backgroundMethod()
  async getCachedPrivateBalances(
    p: IPrivateBalanceQuery,
  ): Promise<IPrivateBalanceSnapshot | undefined> {
    return this.balances.getCachedPrivateBalances(p);
  }

  async getHomePrivateBalances(
    p: IStrk20AccountKey,
  ): Promise<IPrivateBalanceSnapshot | undefined> {
    return this.balances.getHomePrivateBalances(p);
  }

  @backgroundMethod()
  async getPrivateBalances(
    p: IPrivateBalanceQuery,
  ): Promise<IPrivateBalanceSnapshot> {
    return this.balances.getPrivateBalances(p);
  }

  @backgroundMethod()
  async refreshPrivateBalances(
    p: IPrivateBalanceQuery & { allowPrompt?: boolean },
  ): Promise<IPrivateBalanceSnapshot> {
    return this.balances.refreshPrivateBalances(p);
  }

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
    cursorExpired?: boolean;
    cursor?: IStrk20HistoryCursor;
  }> {
    return this.history.fetchPrivateHistory(p);
  }

  @backgroundMethod()
  async resolvePrivateHistoryTx(
    p: IStrk20AccountKey & { txid: string },
  ): Promise<IAccountHistoryTx | undefined> {
    return this.history.resolvePrivateHistoryTx(p);
  }

  rememberPendingPrivateHistoryTx(
    p: IStrk20AccountKey & { poolAddress: string; tx: IAccountHistoryTx },
  ): void {
    this.history.rememberPendingTx(buildPrivacyCacheKey(p), p.tx);
  }

  @backgroundMethod()
  async buildRegisterTx(
    p: IStrk20AccountKey & { resumeOnly?: boolean },
  ): Promise<
    | { alreadyRegistered: true }
    | { alreadyRegistered: false; unsignedTx: IUnsignedTxPro }
  > {
    return this.txBuilder.buildRegisterTx(p);
  }

  async buildPrivateTransferTx(
    p: IStrk20AccountKey & {
      kind: IStrk20TransferKind;
      tokenAddress: string;
      amount: string;
      recipient?: string;
    },
  ): Promise<{ unsignedTx: IUnsignedTxPro; warnings: IStrk20Warning[] }> {
    return this.txBuilder.buildPrivateTransferTx(p);
  }

  // ------------------------------------------------ SDK context assembly

  private async getPrivacyContext(
    p: {
      networkId: string;
      accountId: string;
      allowPrompt: boolean;
      purpose?: 'read' | 'register' | 'transfer';
    },
    knownConfig?: IStrk20PrivacyNetworkConfig,
  ): Promise<IStarknetPrivacyContext> {
    const generation = this.viewingKeys.getGeneration();
    const authorization = this.viewingKeys.getAuthorizationGeneration();
    const config =
      knownConfig ?? (await this.getPrivacyConfig({ networkId: p.networkId }));
    if (!config) throw strk20Error(EStrk20ErrorCode.Unavailable);
    const poolAddress = config.poolAddress;
    const scopeKey = buildPrivacyCacheKey({ ...p, poolAddress });
    const keyGeneration = this.viewingKeys.getKeyGeneration(scopeKey);
    const assertSession = () => {
      if (
        generation !== this.viewingKeys.getGeneration() ||
        keyGeneration !== this.viewingKeys.getKeyGeneration(scopeKey) ||
        (p.purpose !== 'read' &&
          authorization !== this.viewingKeys.getAuthorizationGeneration())
      ) {
        throw strk20Error(EStrk20ErrorCode.Locked);
      }
    };
    if (await this.isDisabledByServer(p.networkId)) {
      throw strk20Error(EStrk20ErrorCode.Unavailable);
    }
    assertSession();
    const vault = await this.getStarknetVault(p);
    const client = await vault.getClient();
    if (!(await this.supportsPrivacyRpc(client, config))) {
      throw strk20Error(EStrk20ErrorCode.Unavailable);
    }
    const [account, network] = await Promise.all([
      vault.getAccount(),
      vault.getNetwork(),
    ]);
    assertSession();

    let cachedCredentials: IStarknetPrivacyCredentials | undefined;
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

    const viewing = await this.viewingKeys.ensureViewingKey({
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

  private async getRegisteredPrivacyContext(
    p: IStrk20AccountKey,
    purpose: 'read' | 'transfer' = 'transfer',
    allowPrompt = true,
  ): Promise<IStarknetPrivacyContext | undefined> {
    const generation = this.viewingKeys.getGeneration();
    const config = await this.getPrivacyConfig(p);
    if (!config) throw strk20Error(EStrk20ErrorCode.Unavailable);
    const scopeKey = buildPrivacyCacheKey({
      ...p,
      poolAddress: config.poolAddress,
    });
    const keyGeneration = this.viewingKeys.getKeyGeneration(scopeKey);
    const state = await this.getAccountPrivacyState(p);
    if (
      generation !== this.viewingKeys.getGeneration() ||
      keyGeneration !== this.viewingKeys.getKeyGeneration(scopeKey)
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
      this.viewingKeys.dropScope({ ...p, poolAddress: ctx.poolAddress });
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
      this.viewingKeys.dropScope({ ...p, poolAddress: ctx.poolAddress });
      throw strk20Error(EStrk20ErrorCode.KeyMismatch);
    }
    return ctx;
  }
}

export default ServiceStarknetPrivacy;
