// cspell:ignore Zashi lightd
/* cspell:ignore Ufvks */
import { validateZcashTransparentAddress } from '@onekeyhq/core/src/chains/zcash/sdkZcash';
import { ZCASH_NETWORK_MAIN } from '@onekeyhq/core/src/chains/zcash/sdkZcash/constants';
import {
  ZCASH_LIGHTD_CHAIN_NAMES,
  fetchZcashChainTipDirect,
  fetchZcashLightdInfoDirect,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash/impl/chainTipDirect';
import type {
  IZcashBalance,
  IZcashCreatedPczt,
  IZcashParsedTransparentTransaction,
  IZcashSpendSource,
  IZcashSyncProgress,
  IZcashTransparentOutpoint,
  IZcashTransparentTxRequest,
  IZcashWalletAccount,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';
import { isSupportedZcashUnifiedAddress } from '@onekeyhq/core/src/chains/zcash/sdkZcash/unifiedAddress';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  IEncodedTx,
  ISignedTxPro,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import { ZCASH_ORCHARD_ACTIVATION_HEIGHT_MAINNET } from '@onekeyhq/shared/src/config/zcash';
import {
  OneKeyInternalError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { LRUCache } from '@onekeyhq/shared/src/utils/cacheUtils';
import type { IPrivacyChainComposedBalance } from '@onekeyhq/shared/src/utils/privacyChainBalanceUtils';
import {
  gateLocalWalletHistoryDetail,
  gateLocalWalletHistoryTx,
} from '@onekeyhq/shared/src/utils/privacyChainHistoryAddressGate';
import type {
  IFetchServerAccountDetailsParams,
  IFetchServerAccountDetailsResponse,
} from '@onekeyhq/shared/types/address';
import type {
  IMeasureRpcStatusParams,
  IMeasureRpcStatusResult,
} from '@onekeyhq/shared/types/customRpc';
import type { IDeviceSharedCallParams } from '@onekeyhq/shared/types/device';
import type {
  IEstimateGasParams,
  IServerEstimateFeeResponse,
} from '@onekeyhq/shared/types/fee';
import type {
  IAccountHistoryTx,
  IServerFetchAccountHistoryDetailParams,
  IServerFetchAccountHistoryDetailResp,
} from '@onekeyhq/shared/types/history';
import type {
  IFetchServerTokenDetailParams,
  IFetchServerTokenDetailResponse,
  IFetchServerTokenListParams,
  IFetchServerTokenListResponse,
} from '@onekeyhq/shared/types/serverToken';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

import { allowPrivacyChainRelayProbe } from '../../../utils/privacyChainRelayTargets';
import { getLocalWalletHistoryAddressGate } from '../../localWallet/historyAddressGate';
import { localWalletText } from '../../localWallet/messages';
import VaultBtc from '../btc/Vault';

import {
  getZcashAccountUfvk,
  hasZcashAccountViewingKey,
  refreshZcashAccountAddressCache,
} from './accountMeta';
import {
  markZcashBackendShieldedCounterparty,
  normalizeZcashBackendHistoryTx,
} from './backendHistory';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import { ZcashPrivacyMode } from './privacyMode';
import * as zcashBalance from './vaultBalance';
import * as zcashHistory from './vaultHistory';
import * as zcashLifecycle from './vaultLifecycle';
import * as zcashSend from './vaultSend';
import * as zcashTransparent from './vaultTransparent';
import {
  createZcashSetupIncompleteError,
  zcashDescribeError,
} from './vaultUtils';

import type { IEncodedTxZcash } from './types';
import type { IDBUtxoAccount, IDBWalletType } from '../../../dbs/local/types';
import type {
  IZcashAccountMeta,
  IZcashBirthdaySource,
  IZcashPendingRescan,
} from '../../../dbs/simple/entity/SimpleDbEntityZcash';
import type { KeyringBase } from '../../base/KeyringBase';
import type {
  ILocalWalletAccountBalance,
  ILocalWalletCapability,
  ILocalWalletSendPool,
} from '../../localWallet/types';
import type {
  IBroadcastTransactionByCustomRpcParams,
  IBroadcastTransactionParams,
  IBuildDecodedTxParams,
  IBuildEncodedTxParams,
  IBuildUnsignedTxParams,
  IRescanLocalWalletFrom,
  IUpdateUnsignedTxParams,
} from '../../types';
import type BigNumber from 'bignumber.js';

// Shielded pools are computed by the runtime carrier via PCZT/WASM only -- never BTC sighash; QR signing unsupported.
export default class Vault extends VaultBtc {
  override coreApi = coreChainApi.zec.hd;

  override keyringMap: Record<IDBWalletType, typeof KeyringBase | undefined> = {
    hd: KeyringHd,
    qr: undefined,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  override getBlockbookCoinName() {
    return 'Zcash';
  }

  override async validateAddress(address: string) {
    if (address.startsWith('u1')) {
      const isValid = isSupportedZcashUnifiedAddress(address);
      return {
        isValid,
        normalizedAddress: isValid ? address : '',
        displayAddress: isValid ? address : '',
      };
    }
    return validateZcashTransparentAddress({
      address,
      network: await this.getBtcForkNetwork(),
    });
  }

  // An enabled custom node wins; otherwise the built-in one, so turning a custom node off never stops sync.
  async zcashResolveLightwalletdUrl(): Promise<string> {
    const url =
      await this.backgroundApi.serviceCustomRpc.resolveRpcUrlWithBuiltIn({
        networkId: this.networkId,
      });
    if (!url) {
      throw new OneKeyLocalError(
        localWalletText(ETranslations.privacy_error_no_node__msg),
      );
    }
    return url;
  }

  // Probes via the scanner's transport; the node still needs gRPC-web, not just CORS-friendly networking.
  async zcashTestLightwalletdUrl(
    url: string,
    options?: { validateChain?: boolean },
  ): Promise<{ ok: boolean; chainTip?: number; reason?: string }> {
    let normalized: string;
    try {
      const parsed = new URL(url.trim());
      if (parsed.protocol !== 'https:') {
        return { ok: false, reason: 'not-https' };
      }
      if (parsed.search || parsed.hash || parsed.username || parsed.password) {
        return { ok: false, reason: 'invalid-url' };
      }
      normalized = parsed.toString().replace(/\/+$/, '');
    } catch {
      return { ok: false, reason: 'invalid-url' };
    }
    // The runtime reaches the node through the host relay, which serves only
    // configured nodes; this one is not saved yet.
    const releaseProbe = allowPrivacyChainRelayProbe(normalized);
    try {
      const api = await this.zcashGetApi();
      const tip = await api.getChainTip({
        network: ZCASH_NETWORK_MAIN,
        lightwalletdUrl: normalized,
      });
      if (tip === null) {
        return { ok: false, reason: 'unreachable' };
      }
      // Only catches a stale or very young chain: testnet is already past this height.
      if (tip < ZCASH_ORCHARD_ACTIVATION_HEIGHT_MAINNET) {
        return { ok: false, chainTip: tip, reason: 'wrong-chain' };
      }
      if (options?.validateChain) {
        // Lenient: only a known, different chain name rejects; no answer keeps the pass.
        const info = await fetchZcashLightdInfoDirect({
          lightwalletdUrl: normalized,
        });
        if (
          info &&
          ZCASH_LIGHTD_CHAIN_NAMES.includes(info.chainName) &&
          info.chainName !== ZCASH_NETWORK_MAIN
        ) {
          return { ok: false, chainTip: tip, reason: 'wrong-chain' };
        }
      }
      return { ok: true, chainTip: tip };
    } catch (e) {
      console.error('[zcash] endpoint probe failed', {
        ...zcashDescribeError(e),
      });
      return { ok: false, reason: 'unreachable' };
    } finally {
      releaseProbe();
    }
  }

  // bestBlockNumber here is the lightwalletd chain tip; the gRPC-web check above is what actually decides pass/fail.
  override async getCustomRpcEndpointStatus(
    params: IMeasureRpcStatusParams,
  ): Promise<IMeasureRpcStatusResult> {
    const start = performance.now();
    const result = await this.zcashTestLightwalletdUrl(params.rpcUrl, {
      validateChain: params.validateChainId,
    });
    if (!result.ok || result.chainTip === undefined) {
      throw new OneKeyInternalError(
        `Zcash node cannot serve this wallet: ${result.reason ?? 'unreachable'}`,
      );
    }
    return {
      responseTime: Math.floor(performance.now() - start),
      bestBlockNumber: result.chainTip,
    };
  }

  // useDefaultRpc skips the custom-RPC branch -- routing through it recurses into broadcastTransaction forever.
  async zcashBroadcastTransparentViaBackend(
    params: IBroadcastTransactionParams,
  ): Promise<ISignedTxPro> {
    return super.broadcastTransaction({ ...params, useDefaultRpc: true });
  }

  // Custom node here is the scanner's endpoint, not a broadcast target -- transparent sends redirect to the backend.
  override async broadcastTransactionFromCustomRpc(
    params: IBroadcastTransactionByCustomRpcParams,
  ): Promise<ISignedTxPro> {
    const { customRpcInfo: _customRpcInfo, ...rest } = params;
    return this.broadcastTransaction(rest);
  }

  async zcashGetApi() {
    const zcashSdk = (
      await import('@onekeyhq/core/src/chains/zcash/sdkZcash/sdk')
    ).default;
    return zcashSdk.getZcashApi();
  }

  // Debug trace is off by default; firing several times a second during a boost can itself slow the page measuring it.
  async zcashSetPerfTrace({ enabled }: { enabled: boolean }): Promise<void> {
    const api = await this.zcashGetApi();
    await api.setPerfTrace({ enabled });
  }

  async zcashGetAccountMeta({
    accountId,
  }: {
    accountId: string;
  }): Promise<IZcashAccountMeta | undefined> {
    const walletId = accountUtils.getWalletIdFromAccountId({ accountId });
    return refreshZcashAccountAddressCache({
      accountId,
      store: this.backgroundApi.simpleDb.zcash,
      isHardware: accountUtils.isHwWallet({ walletId }),
      deriveAddresses: async (meta) => {
        const api = await this.zcashGetApi();
        return api.deriveAddressFromUfvk({
          network: ZCASH_NETWORK_MAIN,
          ufvk: await this.zcashGetAccountUfvk({ accountId, meta }),
          // Address derivation is offline and does not use a node endpoint.
          lightwalletdUrl: '',
        });
      },
    });
  }

  async zcashGetAccountUfvk({
    accountId,
    meta,
  }: {
    accountId: string;
    meta: IZcashAccountMeta;
  }): Promise<string> {
    return getZcashAccountUfvk({
      backgroundApi: this.backgroundApi,
      networkId: this.networkId,
      accountId,
      meta,
    });
  }

  async zcashHasAccountViewingKey({
    accountId,
    vkFp,
  }: {
    accountId: string;
    vkFp: string;
  }): Promise<boolean> {
    return hasZcashAccountViewingKey({
      backgroundApi: this.backgroundApi,
      networkId: this.networkId,
      accountId,
      vkFp,
    });
  }

  async zcashGetWalletAccount({
    accountId,
  }: {
    accountId: string;
  }): Promise<IZcashWalletAccount> {
    const meta = await this.zcashGetAccountMeta({ accountId });
    if (!meta) {
      // Meta is written once at account creation; if missing, that derivation
      // failed. Recover via retryLocalWalletSetup -- never delete and re-add.
      console.log(
        '[zcash] shielded account meta missing -- initial derivation ' +
          'never completed (see "shielded account meta derivation failed" ' +
          'for why); call ServicePrivacyChain.retryLocalWalletSetup to retry',
        { accountId },
      );
      throw createZcashSetupIncompleteError();
    }
    return {
      network: ZCASH_NETWORK_MAIN,
      lightwalletdUrl: await this.zcashResolveLightwalletdUrl(),
      ufvk: await this.zcashGetAccountUfvk({ accountId, meta }),
      seedFingerprintHex: meta.seedFingerprintHex,
      hdIndex: meta.hdIndex,
      birthdayHeight: meta.birthdayHeight,
    };
  }

  async zcashDropExpiredTransparentSends(
    params: Parameters<
      typeof zcashTransparent.zcashDropExpiredTransparentSends
    >[1],
  ): Promise<void> {
    return zcashTransparent.zcashDropExpiredTransparentSends(this, params);
  }

  async zcashCreatePczt(params: {
    accountId: string;
    toAddress: string;
    valueZat: string;
    spendSource: IZcashSpendSource;
    memoHex?: string;
  }): Promise<IZcashCreatedPczt> {
    return zcashSend.zcashCreatePczt(this, params);
  }

  async zcashProvePczt(params: {
    accountId: string;
    pcztHex: string;
  }): Promise<{ pcztHex: string }> {
    return zcashSend.zcashProvePczt(this, params);
  }

  zcashPrivacyMode(): ZcashPrivacyMode {
    return new ZcashPrivacyMode(this.backgroundApi);
  }

  override getLocalWalletCapability(): ILocalWalletCapability {
    return zcashLifecycle.getLocalWalletCapability(this);
  }

  // Only HD/hardware accounts derive a viewing key; imported/watch-only can send/watch transparent funds but never scan.
  override supportsAccountWalletType({
    accountId,
  }: {
    accountId: string;
  }): boolean {
    return (
      accountUtils.isHdAccount({ accountId }) ||
      accountUtils.isHwAccount({ accountId })
    );
  }

  async onPrivacyWalletCreated(params: {
    walletId: string;
    isFreshlyGeneratedMnemonic: boolean;
    createdAt: number;
  }): Promise<void> {
    return zcashLifecycle.onPrivacyWalletCreated(this, params);
  }

  async resumePendingPrivacyOperations(): Promise<void> {
    return zcashLifecycle.resumePendingPrivacyOperations(this);
  }

  async gcPrivacyWalletState(params: {
    liveWalletIds: string[];
  }): Promise<void> {
    return zcashLifecycle.gcPrivacyWalletState(this, params);
  }

  async listLocalWalletAccounts(): Promise<{
    accounts: {
      accountId: string;
      runtimeKey: string;
      accountRuntimeKey: string;
      syncEnabled: boolean;
      slotEnabled: boolean;
    }[];
    cleanupAccountIds: string[];
    storedAccountIds: string[];
  }> {
    return zcashLifecycle.listLocalWalletAccounts(this);
  }

  async getLocalWalletAccountAliases(params: {
    accountId: string;
  }): Promise<string[]> {
    return zcashLifecycle.getLocalWalletAccountAliases(this, params);
  }

  async zcashPrepareAccounts(params: {
    accountIds: string[];
    chainTip?: number | null;
  }): Promise<IZcashWalletAccount[]> {
    return zcashLifecycle.zcashPrepareAccounts(this, params);
  }

  async zcashHealOutOfRangeBirthdays(params: {
    accountIds: string[];
    accounts: IZcashWalletAccount[];
    chainTip?: number | null;
  }): Promise<void> {
    return zcashLifecycle.zcashHealOutOfRangeBirthdays(this, params);
  }

  async resetLocalWalletCarrier(): Promise<void> {
    const api = await this.zcashGetApi();
    await api.resetCarrier();
  }

  async recoverLocalWalletFromTimeout(): Promise<boolean> {
    return zcashLifecycle.recoverLocalWalletFromTimeout(this);
  }

  // Runtime first; falls back to a direct background fetch when the native file:// carrier can't reach lightwalletd.
  async getLocalWalletChainTip(): Promise<number | null> {
    const api = await this.zcashGetApi();
    const lightwalletdUrl = await this.zcashResolveLightwalletdUrl();
    const runtimeTip = await api.getChainTip({
      network: ZCASH_NETWORK_MAIN,
      lightwalletdUrl,
    });
    if (runtimeTip !== null) return runtimeTip;
    return fetchZcashChainTipDirect({ lightwalletdUrl });
  }

  async prewarmLocalWalletSend(params: {
    accountId: string;
    sourcePool: string;
    toAddress: string;
  }): Promise<void> {
    return zcashLifecycle.prewarmLocalWalletSend(this, params);
  }

  async syncLocalWalletGroup(params: {
    accountIds: string[];
    rescanFrom?: { accountId: string; fromHeight: number };
    chainTip?: number | null;
  }): Promise<{
    synced: boolean;
    stateChanged?: boolean;
    chainTip?: number | null;
    backfillRemaining?: boolean;
  }> {
    return zcashLifecycle.syncLocalWalletGroup(this, params);
  }

  async zcashRebuildRuntimeDatabase(): Promise<void> {
    return zcashLifecycle.zcashRebuildRuntimeDatabase(this);
  }

  async zcashPreparePrivacyModeAccount(params: {
    accountId: string;
    fromHeight: number;
    birthday?: IRescanLocalWalletFrom;
    onPrepared: () => Promise<void>;
  }): Promise<void> {
    return zcashLifecycle.zcashPreparePrivacyModeAccount(this, params);
  }

  async syncLocalWalletGroupImpl(params: {
    accountIds: string[];
    rescanFrom?: { accountId: string; fromHeight: number };
    chainTip?: number | null;
    prepareAccountId?: string;
    prepareBirthday?: IRescanLocalWalletFrom;
    onPrepared?: () => Promise<void>;
  }): Promise<{
    synced: boolean;
    stateChanged?: boolean;
    chainTip?: number | null;
    backfillRemaining?: boolean;
  }> {
    return zcashLifecycle.syncLocalWalletGroupImpl(this, params);
  }

  async queueLocalWalletRescanFrom({
    accountId,
    fromHeight,
  }: {
    accountId: string;
    fromHeight: number;
  }): Promise<{ queued: boolean; fromHeight: number; toHeight: number }> {
    const account = await this.zcashGetWalletAccount({ accountId });
    const api = await this.zcashGetApi();
    return api.queueRescanFrom(account, { fromHeight });
  }

  async resetLocalWallet(params: {
    accountId: string;
    scope: 'cache' | 'all';
  }): Promise<void> {
    return zcashLifecycle.resetLocalWallet(this, params);
  }

  async deleteLocalPrivacyData(params: { accountId: string }): Promise<void> {
    return zcashLifecycle.deleteLocalPrivacyData(this, params);
  }

  async zcashRetryLocalWalletSetup(params: {
    password?: string;
    deviceParams?: IDeviceSharedCallParams;
  }): Promise<void> {
    return zcashLifecycle.zcashRetryLocalWalletSetup(this, params);
  }

  async zcashTryAutoRepairLocalWalletSetupIfUnlocked(): Promise<boolean> {
    return zcashLifecycle.zcashTryAutoRepairLocalWalletSetupIfUnlocked(this);
  }

  async getLocalWalletAccountMeta({
    accountId,
  }: {
    accountId: string;
  }): Promise<IZcashAccountMeta | undefined> {
    return this.zcashGetAccountMeta({ accountId });
  }

  async listLocalWalletSendPools(params: {
    accountId: string;
    toAddress?: string;
  }): Promise<ILocalWalletSendPool[] | undefined> {
    return zcashBalance.listLocalWalletSendPools(this, params);
  }

  // Single gate for every scanner-touching entry point; also catches an account stuck mid-operation that intent alone would miss.
  async zcashPrivacyModeIsActive(accountId: string): Promise<boolean> {
    const state = await this.backgroundApi.simpleDb.zcash.getPrivacyModeState({
      accountId,
    });
    return state.intent === 'on' && state.operation === undefined;
  }

  async getLocalWalletAccountBalance(params: {
    accountId: string;
  }): Promise<ILocalWalletAccountBalance | null> {
    return zcashBalance.getLocalWalletAccountBalance(this, params);
  }

  async getLocalWalletBalance(params: {
    accountId: string;
    liveWaitMs?: number;
    fresh?: boolean;
  }): Promise<IZcashBalance | null> {
    return zcashBalance.getLocalWalletBalance(this, params);
  }

  async getLocalWalletSyncProgress(params: {
    accountId: string;
  }): Promise<IZcashSyncProgress> {
    return zcashLifecycle.getLocalWalletSyncProgress(this, params);
  }

  async applyPendingRescan(params: {
    accountId: string;
    repair: IZcashPendingRescan;
  }): Promise<void> {
    return zcashLifecycle.applyPendingRescan(this, params);
  }

  async zcashResumePendingRescans(requiredAccountId?: string): Promise<void> {
    return zcashLifecycle.zcashResumePendingRescans(this, requiredAccountId);
  }

  async zcashRescanFromHeight(params: {
    accountId: string;
    birthdayHeight: number;
    birthdaySource: IZcashBirthdaySource;
    birthdayTimestamp?: number;
  }): Promise<void> {
    return zcashLifecycle.zcashRescanFromHeight(this, params);
  }

  async rescanLocalWallet(params: {
    accountId: string;
    from: IRescanLocalWalletFrom;
    dryRun?: boolean;
  }): Promise<{ fromHeight: number }> {
    return zcashLifecycle.rescanLocalWallet(this, params);
  }

  async zcashGetBalanceSafe(): Promise<IZcashBalance | null> {
    return zcashBalance.zcashGetBalanceSafe(this);
  }

  override async fetchAccountDetails(
    params: IFetchServerAccountDetailsParams,
  ): Promise<IFetchServerAccountDetailsResponse> {
    return zcashBalance.fetchAccountDetails(this, params);
  }

  override async fetchTokenList(
    params: IFetchServerTokenListParams,
  ): Promise<IFetchServerTokenListResponse> {
    return zcashBalance.fetchTokenList(this, params);
  }

  async zcashGetIndexerTransparentBalance(params: {
    account: IDBUtxoAccount;
    rawTxRetries?: number;
  }): Promise<{
    total?: BigNumber;
    spendable?: BigNumber;
    coinbase?: BigNumber;
  }> {
    return zcashBalance.zcashGetIndexerTransparentBalance(this, params);
  }

  async zcashFetchTransparentTokenDetails(
    params: IFetchServerTokenDetailParams,
  ): Promise<IFetchServerTokenDetailResponse> {
    return zcashBalance.zcashFetchTransparentTokenDetails(this, params);
  }

  override async fetchTokenDetails(
    params: IFetchServerTokenDetailParams,
  ): Promise<IFetchServerTokenDetailResponse> {
    return zcashBalance.fetchTokenDetails(this, params);
  }

  async zcashFetchBackendHistoryDetail(
    params: IServerFetchAccountHistoryDetailParams,
  ): Promise<IServerFetchAccountHistoryDetailResp> {
    return zcashHistory.zcashFetchBackendHistoryDetail(this, params);
  }

  override async fetchAccountHistoryDetail(
    params: IServerFetchAccountHistoryDetailParams,
  ): Promise<IServerFetchAccountHistoryDetailResp> {
    const response = await zcashHistory.fetchAccountHistoryDetail(this, params);
    const detail = response.data.data.data;
    if (detail) {
      const gate = await getLocalWalletHistoryAddressGate({
        backgroundApi: this.backgroundApi,
        networkId: this.networkId,
        accountId: params.accountId || this.accountId,
      });
      response.data.data.data = gateLocalWalletHistoryDetail(gate, detail);
    }
    return response;
  }

  override async fetchAccountHistoryFromLocal(params: {
    accountId: string;
    networkId: string;
    accountAddress: string;
    xpub?: string;
    isManualRefresh?: boolean;
  }): Promise<IAccountHistoryTx[] | undefined> {
    const gate = await getLocalWalletHistoryAddressGate({
      backgroundApi: this.backgroundApi,
      networkId: params.networkId,
      accountId: params.accountId || this.accountId,
    });
    const txs = await zcashHistory.fetchAccountHistoryFromLocal(this, {
      ...params,
      addressGate: gate,
    });
    if (!txs?.length) return txs;
    return txs.map((tx) => gateLocalWalletHistoryTx(gate, tx));
  }

  // BTC's override asks F2pool about acceleration, which never applies to zec txids.
  override async getPendingTxsToUpdate(_params: {
    pendingTxs: IAccountHistoryTx[];
  }): Promise<IAccountHistoryTx[]> {
    return [];
  }

  async zcashGetComposedBalanceSafe(
    publicSideBackend?: string,
  ): Promise<IPrivacyChainComposedBalance> {
    return zcashBalance.zcashGetComposedBalanceSafe(this, publicSideBackend);
  }

  async zcashFetchTransparentHistory(params: {
    accountId: string;
    networkId: string;
    accountAddress: string;
    xpub?: string;
    isManualRefresh?: boolean;
  }): Promise<{
    txs: IAccountHistoryTx[];
    snapshotComplete: boolean;
    tipHeight?: number;
  }> {
    return zcashHistory.zcashFetchTransparentHistory(this, params);
  }

  zcashTransparentAccountIndex(account: IDBUtxoAccount): number {
    return zcashTransparent.zcashTransparentAccountIndex(this, account);
  }

  zcashNormalizeTransparentPath(params: {
    path: string;
    accountIndex: number;
  }): { derivationPath: string; internal: boolean } | undefined {
    return zcashTransparent.zcashNormalizeTransparentPath(this, params);
  }

  zcashPreviousTransactionsCache?: LRUCache<
    string,
    IZcashParsedTransparentTransaction
  >;

  async zcashFetchFreshTransparentUtxos(options?: {
    // Chain-only vault callers (capability methods) name the account.
    account?: IDBUtxoAccount;
    rawTxRetries?: number;
  }): Promise<{
    account: IDBUtxoAccount;
    accountIndex: number;
    targetHeight: number;
    utxos: IZcashTransparentTxRequest['utxos'];
    // Owned mining rewards this build path cannot spend or shield.
    coinbaseZat: string;
  }> {
    return zcashTransparent.zcashFetchFreshTransparentUtxos(this, options);
  }

  async zcashTransparentChange(params: {
    account: IDBUtxoAccount;
    accountIndex: number;
  }): Promise<{ address: string; derivationPath: string }> {
    return zcashTransparent.zcashTransparentChange(this, params);
  }

  zcashTransparentRequest(params: {
    accountIndex: number;
    targetHeight: number;
    utxos: IZcashTransparentTxRequest['utxos'];
    selectedOutpoints: IZcashTransparentOutpoint[];
    toAddress: string;
    amountZat: string;
    memoHex?: string;
    sendMax: boolean;
    change?: IZcashTransparentTxRequest['change'];
  }): IZcashTransparentTxRequest {
    return zcashTransparent.zcashTransparentRequest(this, params);
  }

  async zcashBuildTransparentEncodedTx(params: {
    transferInfo: NonNullable<IBuildEncodedTxParams['transfersInfo']>[number];
    sendMax: boolean;
  }): Promise<IEncodedTxZcash> {
    return zcashTransparent.zcashBuildTransparentEncodedTx(this, params);
  }

  async zcashPrepareFreshTransparentRequest(params: {
    encodedTx: IEncodedTxZcash;
  }): Promise<IZcashTransparentTxRequest> {
    return zcashTransparent.zcashPrepareFreshTransparentRequest(this, params);
  }

  override async buildEstimateFeeParams(params?: {
    encodedTx: IEncodedTx | undefined;
  }) {
    return zcashSend.buildEstimateFeeParams(this, params);
  }

  override async estimateFee(
    params: IEstimateGasParams,
  ): Promise<IServerEstimateFeeResponse> {
    return zcashSend.estimateFee(this, params);
  }

  // BTC's precheck needs a blockbook UTXO list (ordinals guard) that zcash's fetchAccountDetails never provides, which would disable Send permanently.
  override async precheckUnsignedTx(): Promise<boolean> {
    return true;
  }

  // Defense in depth: BTC's bulk-send builder would emit coin-selected txs that bypass the PCZT flow.
  override async buildBulkSendEncodedTxs(): Promise<never> {
    throw new OneKeyInternalError('Batch transfer is not supported');
  }

  override async buildEncodedTx(
    params: IBuildEncodedTxParams,
  ): Promise<IEncodedTxZcash> {
    return zcashSend.buildEncodedTx(this, params);
  }

  override async buildOnChainHistoryTx(
    params: Parameters<VaultBtc['buildOnChainHistoryTx']>[0],
  ) {
    const normalized = normalizeZcashBackendHistoryTx(params.onChainHistoryTx);
    const tx = await super.buildOnChainHistoryTx({
      ...params,
      onChainHistoryTx: normalized,
    });
    if (tx) {
      markZcashBackendShieldedCounterparty({
        onChainHistoryTx: normalized,
        historyTx: tx,
      });
    }
    if (tx?.decodedTx.totalFeeFiatValue === '') {
      tx.decodedTx.totalFeeFiatValue = undefined;
    }
    return tx;
  }

  override async buildHistoryTx(
    params: Parameters<VaultBtc['buildHistoryTx']>[0],
  ): Promise<IAccountHistoryTx> {
    return zcashSend.buildHistoryTx(this, params);
  }

  override async buildDecodedTx(
    params: IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    return zcashSend.buildDecodedTx(this, params);
  }

  override async buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    return zcashSend.buildUnsignedTx(this, params);
  }

  async zcashAttachPczt(encodedTx: IEncodedTxZcash): Promise<IEncodedTxZcash> {
    return zcashSend.zcashAttachPczt(this, encodedTx);
  }

  async zcashPreparePcztForSigning(params: {
    accountId: string;
    pcztHex: string;
    encodedTx: IEncodedTxZcash;
  }): Promise<{ pcztHex: string }> {
    return zcashSend.zcashPreparePcztForSigning(this, params);
  }

  async zcashCombineSignedPczt(params: {
    accountId: string;
    originalPcztHex: string;
    signedPcztHex: string;
  }): Promise<{ pcztHex: string }> {
    return zcashSend.zcashCombineSignedPczt(this, params);
  }

  async zcashParseTransparentOutputs(result: {
    txid: string;
    rawTx: string;
  }): Promise<{ valueZat: string; scriptPubKey: string }[]> {
    return zcashSend.zcashParseTransparentOutputs(this, result);
  }

  override async updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    return zcashSend.updateUnsignedTx(this, params);
  }

  override async broadcastTransaction(
    params: IBroadcastTransactionParams,
  ): Promise<ISignedTxPro> {
    return zcashSend.broadcastTransaction(this, params);
  }

  // Base-class behavior for the split-out modules.
  baseBuildHistoryTx(
    ...args: Parameters<VaultBtc['buildHistoryTx']>
  ): ReturnType<VaultBtc['buildHistoryTx']> {
    return super.buildHistoryTx(...args);
  }

  baseFetchAccountDetails(
    ...args: Parameters<VaultBtc['fetchAccountDetails']>
  ): ReturnType<VaultBtc['fetchAccountDetails']> {
    return super.fetchAccountDetails(...args);
  }

  baseFetchAccountHistoryDetail(
    ...args: Parameters<VaultBtc['fetchAccountHistoryDetail']>
  ): ReturnType<VaultBtc['fetchAccountHistoryDetail']> {
    return super.fetchAccountHistoryDetail(...args);
  }

  baseFetchTokenDetails(
    ...args: Parameters<VaultBtc['fetchTokenDetails']>
  ): ReturnType<VaultBtc['fetchTokenDetails']> {
    return super.fetchTokenDetails(...args);
  }

  baseFetchTokenList(
    ...args: Parameters<VaultBtc['fetchTokenList']>
  ): ReturnType<VaultBtc['fetchTokenList']> {
    return super.fetchTokenList(...args);
  }
}
