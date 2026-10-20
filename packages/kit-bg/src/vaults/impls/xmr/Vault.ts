// cspell:ignore subaddresses
import BigNumber from 'bignumber.js';
import { isEmpty } from 'lodash';

import { readXmrRuntimeError } from '@onekeyhq/core/src/chains/xmr/sdkXmrRuntime';
import type { IXmrRuntimeApi } from '@onekeyhq/core/src/chains/xmr/sdkXmrRuntime';
import { xmrHostFetch } from '@onekeyhq/core/src/chains/xmr/sdkXmrRuntime/sdk/hostFetch';
import type { IXmrNetwork } from '@onekeyhq/core/src/chains/xmr/sdkXmrRuntime/types';
import {
  getXmrReviewRequest,
  parseXmrPreparedTransaction,
  parseXmrSendRequest,
  parseXmrTransaction,
} from '@onekeyhq/core/src/chains/xmr/transactionReview';
import { parseXmrViewingKeyPair } from '@onekeyhq/core/src/chains/xmr/viewingKeys';
import type { IXmrViewingKeyPair } from '@onekeyhq/core/src/chains/xmr/viewingKeys';
import type { ISignedTxPro, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import {
  XMR_DECIMALS,
  XMR_DEFAULT_FEE_PRIORITY,
  XMR_HISTORY_PAGE_SIZE,
} from '@onekeyhq/shared/src/config/xmr';
import {
  NotImplemented,
  OneKeyInternalError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { getPrivacyChainBlocksLeft } from '@onekeyhq/shared/src/utils/privacyChainSyncPolicy';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import type {
  IAddressValidation,
  IFetchServerAccountDetailsParams,
  IFetchServerAccountDetailsResponse,
  IGeneralInputValidation,
  INetworkAccountAddressDetail,
  IPrivateKeyValidation,
  IXprvtValidation,
  IXpubValidation,
} from '@onekeyhq/shared/types/address';
import type {
  IMeasureRpcStatusParams,
  IMeasureRpcStatusResult,
} from '@onekeyhq/shared/types/customRpc';
import type {
  IEstimateGasParams,
  IServerEstimateFeeResponse,
} from '@onekeyhq/shared/types/fee';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import type {
  IFetchServerTokenDetailParams,
  IFetchServerTokenDetailResponse,
  IFetchServerTokenListParams,
  IFetchServerTokenListResponse,
} from '@onekeyhq/shared/types/serverToken';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';
import type { IBalanceStatus } from '@onekeyhq/shared/types/token';
import {
  EDecodedTxActionType,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';
import type { IDecodedTx, IDecodedTxAction } from '@onekeyhq/shared/types/tx';

import { VaultBase } from '../../base/VaultBase';
import { loadCachedLocalWalletHistory } from '../../localWallet/cachedHistory';
import { localWalletText } from '../../localWallet/messages';
import { buildLocalWalletNativeTokenList } from '../../localWallet/tokenList';

import { KeyringHd } from './KeyringHd';
import { buildXmrLocalHistoryTx } from './localHistory';
import { buildXmrLocalWalletCapability } from './localWallet';
import {
  getXmrChainTip,
  getXmrIdentityId,
  getXmrLocalRuntime,
  getXmrRuntime,
  readXmrStaleFirst,
} from './runtime';

import type { IEncodedTxXmr, IXmrHistoryItem } from './types';
import type { IDBWalletType } from '../../../dbs/local/types';
import type { KeyringBase } from '../../base/KeyringBase';
import type { ILocalWalletCapability } from '../../localWallet/types';
import type {
  IBroadcastTransactionByCustomRpcParams,
  IBroadcastTransactionParams,
  IBuildAccountAddressDetailParams,
  IBuildDecodedTxParams,
  IBuildEncodedTxParams,
  IBuildUnsignedTxParams,
  IGetPrivateKeyFromImportedParams,
  IGetPrivateKeyFromImportedResult,
  ITransferInfo,
  IUpdateUnsignedTxParams,
  IValidateGeneralInputParams,
} from '../../types';

/** Maps runtime errors to actionable messages; anything not ours passes through. */
function toXmrUserFacingError(error: unknown): unknown {
  const runtime = readXmrRuntimeError(error);
  if (!runtime) return error;
  // `detail` is log-only by contract (not translated), but it's the only clue
  // to whether the node is down, lacks CORS, or was mistyped - log it, don't drop it.
  if (runtime.detail) {
    console.error('[xmr] runtime error', {
      code: runtime.code,
      params: runtime.params,
      detail: runtime.detail,
    });
  }
  if (runtime.params?.reason === 'insufficientUnlockedFunds') {
    return new OneKeyLocalError({
      key: ETranslations.send_error_insufficient_balance,
      info: { token: 'XMR' },
    });
  }
  if (runtime.code === 'NODE_NOT_CONFIGURED') {
    return new OneKeyLocalError(
      localWalletText(ETranslations.privacy_error_no_node__msg),
    );
  }
  if (runtime.code === 'BROADCAST_REJECTED') {
    return new OneKeyLocalError(
      localWalletText(ETranslations.privacy_error_broadcast_rejected__msg),
    );
  }
  if (runtime.code === 'NETWORK_ERROR') {
    return new OneKeyLocalError(
      localWalletText(ETranslations.privacy_error_node_unreachable__msg),
    );
  }
  if (runtime.code === 'STORAGE_UNSUPPORTED') {
    return new OneKeyLocalError(
      localWalletText(ETranslations.privacy_error_webview_outdated__msg),
    );
  }
  return error;
}

/**
 * Monero vault. Extends `VaultBase`, not `VaultBtc`: Monero has no UTXO/xpub
 * side. Send path is prepare -> sign -> broadcast (like Zcash's PCZT) because
 * the fee depends on the built transaction's weight, not a flat rate.
 */
export default class Vault extends VaultBase {
  override keyringMap: Record<IDBWalletType, typeof KeyringBase | undefined> = {
    hd: KeyringHd,
    // No watch-only story: detecting spends needs key images, which need
    // the spend key; a watching account would show an unverifiable balance.
    watching: undefined,
    imported: undefined,
    // Firmware has a Monero impl inherited from Trezor, but @onekeyfe/hd-core
    // exposes no API for it yet.
    hw: undefined,
    qr: undefined,
    external: undefined,
  };

  /**
   * The account's viewing pair (`spendPub:viewPriv`, the analogue of a Zcash
   * UFVK) from the privacy-chain viewing key store. A missing copy is rebuilt
   * from the mnemonic once a password is cached; until then this throws.
   */
  async getXmrViewingKeys({
    accountId,
  }: {
    accountId: string;
  }): Promise<IXmrViewingKeyPair & { primaryAddress: string }> {
    const [account, stored] = await Promise.all([
      this.backgroundApi.serviceAccount.getAccount({
        accountId,
        networkId: this.networkId,
      }),
      this.backgroundApi.servicePrivacyChain.ensureLocalWalletViewingKey({
        networkId: this.networkId,
        accountId,
      }),
    ]);
    if (!stored) {
      throw new OneKeyLocalError(
        'xmr: viewing key unavailable until the wallet is unlocked',
      );
    }
    return {
      primaryAddress: account.address,
      ...parseXmrViewingKeyPair(stored),
    };
  }

  async getXmrNetwork(): Promise<IXmrNetwork> {
    const network = await this.getNetwork();
    return network.isTestnet ? 'testnet' : 'mainnet';
  }

  /**
   * `enabled: false` is honoured, not worked around: unlike chains with a
   * backend, disabling the node here means no data source at all - say so.
   */
  async resolveXmrNodeUrl(): Promise<string> {
    const record = await this.backgroundApi.serviceCustomRpc.ensureBuiltInRpc({
      networkId: this.networkId,
    });
    if (!record?.rpc || !record.enabled) {
      throw new OneKeyLocalError(
        localWalletText(ETranslations.privacy_error_no_node__msg),
      );
    }
    return record.rpc;
  }

  async getXmrRuntimeApi(): Promise<IXmrRuntimeApi> {
    return getXmrRuntime(this);
  }

  override getLocalWalletCapability(): ILocalWalletCapability {
    return buildXmrLocalWalletCapability(this);
  }

  override async buildAccountAddressDetail(
    params: IBuildAccountAddressDetailParams,
  ): Promise<INetworkAccountAddressDetail> {
    const { account, networkId } = params;
    // Address is stored on the account record at creation time (KeyringHd);
    // no runtime/DB/node needed.
    const address = account.address ?? '';
    return {
      networkId,
      normalizedAddress: address,
      displayAddress: address,
      address,
      baseAddress: address,
      isValid: Boolean(address),
      allowEmptyAddress: false,
    };
  }

  override async validateAddress(address: string): Promise<IAddressValidation> {
    // Network-scoped: a mainnet address sent to from testnet is not merely
    // "wrong network", it's unspendable. Validated via the runtime parser.
    const { validateXmrAddress } =
      await import('@onekeyhq/core/src/chains/xmr/sdkXmrRuntime/address');
    const network = await this.getXmrNetwork();
    const isValid = await validateXmrAddress({ address, network });
    return {
      isValid,
      normalizedAddress: isValid ? address : '',
      displayAddress: isValid ? address : '',
    };
  }

  override async buildEncodedTx(
    params: IBuildEncodedTxParams,
  ): Promise<IEncodedTxXmr> {
    const { transfersInfo } = params;
    if (!transfersInfo || isEmpty(transfersInfo)) {
      throw new OneKeyInternalError('transfersInfo is required');
    }
    if (transfersInfo.length > 1) {
      // Monero supports multi-recipient txs, but the review contract the
      // runtime checks at signing covers exactly one recipient.
      throw new OneKeyInternalError('Batch transfer is not supported');
    }
    return this.buildXmrEncodedTxFromTransfer({
      transferInfo: transfersInfo[0],
      isMaxSend: params.transferPayload?.isMaxSend === true,
    });
  }

  // Must be synced before building: an unscanned block may already have
  // spent the outputs this send would pick (mirrors Cake Wallet's rule).
  private async xmrAssertSyncedForSend(): Promise<void> {
    const capability = this.getLocalWalletCapability();
    const { sendMaxBlocksLeft } = capability.syncPolicy;
    if (sendMaxBlocksLeft === undefined) return;
    const progress = await capability.getSyncProgress({
      accountId: this.accountId,
    });
    // Scanning off: the runtime may still hold this account's outputs, frozen
    // at the height it stopped, and would build from them.
    if (!progress) {
      throw Object.assign(
        new OneKeyLocalError(
          localWalletText(ETranslations.privacy_send_private_paused__msg),
        ),
        { code: 'XMR_NOT_SYNCED', params: {}, autoToast: true },
      );
    }
    // Progress compares against the display tip, which stops moving while the
    // chain is paused; the lag that matters is against the live tip.
    const liveTip = await getXmrChainTip(await this.getXmrRuntimeApi());
    const progressBlocksLeft = getPrivacyChainBlocksLeft(progress);
    const blocksLeft =
      progressBlocksLeft === null || progress.tipScannedHeight === null
        ? null
        : Math.max(progressBlocksLeft, liveTip - progress.tipScannedHeight);
    if (blocksLeft === null || blocksLeft >= sendMaxBlocksLeft) {
      throw Object.assign(
        new OneKeyLocalError(
          blocksLeft === null
            ? localWalletText(ETranslations.privacy_error_still_syncing__msg)
            : localWalletText(ETranslations.privacy_send_waiting_sync__msg, {
                blocks: blocksLeft,
              }),
        ),
        { code: 'XMR_NOT_SYNCED', params: { blocksLeft }, autoToast: true },
      );
    }
  }

  private async buildXmrEncodedTxFromTransfer(params: {
    transferInfo: ITransferInfo;
    isMaxSend: boolean;
  }): Promise<IEncodedTxXmr> {
    const { transferInfo, isMaxSend } = params;
    if (transferInfo.hexData && transferInfo.hexData !== '0x') {
      throw new OneKeyLocalError(
        'Monero transaction messages are not supported',
      );
    }
    if (!transferInfo.to) {
      throw new OneKeyLocalError(
        'buildEncodedTx ERROR: transferInfo.to is missing',
      );
    }
    const validation = await this.validateAddress(transferInfo.to);
    if (!validation.isValid) {
      // Caught here rather than at the node: Monero has no way to recover
      // value sent to a well-formed address nobody holds the keys to.
      throw new OneKeyLocalError(
        localWalletText(ETranslations.send_address_invalid),
      );
    }

    await this.xmrAssertSyncedForSend();

    const account = await this.getAccount();
    const amountAtomic = new BigNumber(transferInfo.amount || '0')
      .shiftedBy(XMR_DECIMALS)
      .toFixed(0, BigNumber.ROUND_DOWN);

    return {
      from: account.address,
      to: transferInfo.to,
      amountAtomic,
      amount: new BigNumber(amountAtomic).shiftedBy(-XMR_DECIMALS).toFixed(),
      priority: XMR_DEFAULT_FEE_PRIORITY,
      isMaxSend,
    };
  }

  override async buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const encodedTx = parseXmrSendRequest(
      params.encodedTx ?? (await this.buildEncodedTx(params)),
    );
    const prepared = await this.xmrPrepareTransaction(encodedTx);
    return {
      encodedTx: prepared,
      transfersInfo: params.transfersInfo ?? [],
    };
  }

  /**
   * Built at review time, not at signing: recomputing later could let the
   * confirmed fee/amount drift from what's actually signed.
   */
  private async xmrPrepareTransaction(
    encodedTx: IEncodedTxXmr,
  ): Promise<IEncodedTxXmr> {
    const api = await this.getXmrRuntimeApi();
    const identityId = await getXmrIdentityId({
      api,
      accountId: this.accountId,
    });
    await this.xmrEnsureKeyImages({ api, identityId });
    const chainTip = await getXmrChainTip(api);

    let raw: string;
    try {
      raw = await api.prepareTransaction(
        identityId,
        stringUtils.stableStringify([
          { address: encodedTx.to, amountAtomic: encodedTx.amountAtomic },
        ]),
        encodedTx.isMaxSend === true,
        String(chainTip),
        encodedTx.priority,
      );
    } catch (error) {
      throw toXmrUserFacingError(error);
    }

    const result = parseXmrPreparedTransaction(JSON.parse(raw));
    if (
      encodedTx.isMaxSend !== true &&
      result.amountAtomic !== encodedTx.amountAtomic
    ) {
      throw new OneKeyLocalError(
        'xmr: prepared transaction does not match the request',
      );
    }
    return parseXmrTransaction({
      ...encodedTx,
      ...result,
      amount: new BigNumber(result.amountAtomic)
        .shiftedBy(-XMR_DECIMALS)
        .toFixed(),
      chainTip,
    });
  }

  /**
   * Confirms real spends via key images (watch-only scanning can't detect
   * outside spends). Spend key is derived for this call only, never kept.
   */
  async xmrImportKeyImages({ password }: { password: string }): Promise<{
    imported: number;
    spendsFound: number;
  }> {
    if (!(this.keyring instanceof KeyringHd)) {
      throw new NotImplemented();
    }
    const spendPrivateKeyHex = await this.keyring.xmrGetSpendPrivateKeyHex({
      password,
    });
    const api = await this.getXmrRuntimeApi();
    const identityId = await getXmrIdentityId({
      api,
      accountId: this.accountId,
    });
    return JSON.parse(
      await api.importKeyImages(identityId, spendPrivateKeyHex),
    ) as { imported: number; spendsFound: number };
  }

  override async localWalletHasPasswordWork(): Promise<boolean> {
    if (!(this.keyring instanceof KeyringHd)) return false;
    const api = await this.getXmrRuntimeApi();
    const identityId = await getXmrIdentityId({
      api,
      accountId: this.accountId,
    });
    return this.xmrCountOutputsWithoutKeyImage({ api, identityId }).then(
      (count) => count > 0,
    );
  }

  override async localWalletDoPasswordWork({
    password,
  }: {
    password: string;
  }): Promise<boolean> {
    const { imported, spendsFound } = await this.xmrImportKeyImages({
      password,
    });
    if (imported > 0) {
      console.log('[xmr] key images imported', { imported, spendsFound });
    }
    return spendsFound > 0;
  }

  private async xmrCountOutputsWithoutKeyImage({
    api,
    identityId,
  }: {
    api: IXmrRuntimeApi;
    identityId: string;
  }): Promise<number> {
    const { outputsWithoutKeyImage } = JSON.parse(
      await api.balance(identityId),
    ) as { outputsWithoutKeyImage?: number };
    return outputsWithoutKeyImage ?? 0;
  }

  // Coin selection only picks outputs with a key image; an output spent
  // elsewhere must be detected first, or a double-spend attempt is built.
  private async xmrEnsureKeyImages({
    api,
    identityId,
  }: {
    api: IXmrRuntimeApi;
    identityId: string;
  }): Promise<void> {
    if (!(this.keyring instanceof KeyringHd)) return;
    if (!(await this.xmrCountOutputsWithoutKeyImage({ api, identityId }))) {
      return;
    }
    const { password } =
      await this.backgroundApi.servicePassword.promptPasswordVerifyByAccount({
        accountId: this.accountId,
        reason: EReasonForNeedPassword.CreateTransaction,
      });
    await this.xmrImportKeyImages({ password });
  }

  override async buildDecodedTx(
    params: IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const { unsignedTx } = params;
    const encodedTx = parseXmrTransaction(unsignedTx.encodedTx);
    const account = await this.getAccount();
    const network = await this.getNetwork();

    const nativeToken = await this.backgroundApi.serviceToken.getNativeToken({
      networkId: this.networkId,
      accountId: this.accountId,
    });

    let action: IDecodedTxAction = {
      type: EDecodedTxActionType.UNKNOWN,
      unknownAction: {
        from: encodedTx.from,
        to: encodedTx.to,
      },
    };

    if (nativeToken) {
      action = await this.buildTxTransferAssetAction({
        from: encodedTx.from,
        to: encodedTx.to,
        transfers: [
          {
            from: encodedTx.from,
            to: encodedTx.to,
            // Always the amount the transaction carries. Max-send resolves
            // here, so the figure the amount screen showed can be stale.
            amount: encodedTx.amount,
            tokenIdOnNetwork: nativeToken.address,
            icon: nativeToken.logoURI ?? '',
            name: nativeToken.name,
            symbol: nativeToken.symbol,
            isNFT: false,
            isNative: true,
          },
        ],
      });
    }

    return {
      txid: '',
      owner: account.address,
      signer: encodedTx.from || account.address,
      nonce: 0,
      to: encodedTx.to,
      actions: [action],
      status: EDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      extraInfo: null,
      encodedTx,
      // Inputs were selected from real spendable outputs at build time; a
      // balance recount on the confirm page could only disagree with it.
      isPsbt: true,
      totalFeeInNative: new BigNumber(encodedTx.feeAtomic || '0')
        .shiftedBy(-network.feeMeta.decimals)
        .toFixed(),
      nativeAmount: encodedTx.amount,
      nativeAmountValue: encodedTx.amountAtomic,
    };
  }

  /**
   * Nothing is adjustable after build: editing fee or amount would
   * invalidate `signableHex` and silently sign something other than reviewed.
   */
  override updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    return Promise.resolve(params.unsignedTx);
  }

  /**
   * Fee read off the already-built transaction; no quote/estimate fallback -
   * showing a fee the tx won't actually pay is worse than showing none.
   */
  override async estimateFee(
    params: IEstimateGasParams,
  ): Promise<IServerEstimateFeeResponse> {
    const network = await this.getNetwork();
    const encodedTx = params.encodedTx as IEncodedTxXmr | undefined;
    if (!encodedTx?.feeAtomic) {
      throw new OneKeyLocalError(
        'xmr: the transaction has not been built yet, so its fee is not known',
      );
    }
    return {
      data: {
        data: {
          isEIP1559: false,
          feeDecimals: network.feeMeta.decimals,
          feeSymbol: network.feeMeta.symbol,
          nativeDecimals: network.decimals,
          nativeSymbol: network.symbol,
          // feeUtils consumes feeValue as an already-parsed native amount.
          feeUTXO: [
            {
              feeValue: new BigNumber(encodedTx.feeAtomic)
                .shiftedBy(-network.feeMeta.decimals)
                .toFixed(),
            },
          ],
        },
      },
    };
  }

  // The runtime always broadcasts through the configured node, so a custom node needs no separate path.
  override async broadcastTransactionFromCustomRpc(
    params: IBroadcastTransactionByCustomRpcParams,
  ): Promise<ISignedTxPro> {
    const { customRpcInfo: _customRpcInfo, ...rest } = params;
    return this.broadcastTransaction(rest);
  }

  /**
   * Irreversible. Marking outputs spent and recording the tx happen
   * together, so a network error is recorded "pending" rather than letting a resend pay twice.
   */
  override async broadcastTransaction(
    params: IBroadcastTransactionParams,
  ): Promise<ISignedTxPro> {
    const { signedTx } = params;
    const encodedTx = signedTx.encodedTx as IEncodedTxXmr | undefined;
    if (!encodedTx?.signableHex || !signedTx.rawTx) {
      throw new OneKeyLocalError(
        localWalletText(ETranslations.privacy_error_review_expired__msg),
      );
    }

    const reviewed = parseXmrTransaction(encodedTx);
    const reviewJson = stringUtils.stableStringify(
      getXmrReviewRequest(reviewed, await this.getXmrNetwork()),
    );
    const api = await this.getXmrRuntimeApi();
    let verifiedTxid: string;
    try {
      verifiedTxid = await api.verifySignedTransaction(
        reviewed.signableHex,
        reviewJson,
        signedTx.rawTx,
      );
    } catch (error) {
      throw toXmrUserFacingError(error);
    }
    if (verifiedTxid !== signedTx.txid) {
      throw new OneKeyLocalError(
        'xmr: unexpected transaction id before broadcast',
      );
    }
    const identityId = await getXmrIdentityId({
      api,
      accountId: this.accountId,
    });

    let raw: string;
    try {
      raw = await api.broadcastTransaction(
        identityId,
        signedTx.rawTx,
        String(encodedTx.chainTip ?? (await getXmrChainTip(api))),
        new BigNumber(reviewed.amountAtomic).plus(reviewed.feeAtomic).toFixed(),
        reviewed.changeAtomic,
        reviewed.signableHex,
        reviewJson,
      );
    } catch (error) {
      console.error('[xmr] broadcast failed', {
        txid: signedTx.txid,
        error,
      });
      // A runtime error is definite: rejected, or refused before sending.
      // Network trouble comes back as a recorded "unknown" instead.
      if (readXmrRuntimeError(error)) {
        throw toXmrUserFacingError(error);
      }
      // The call itself was lost (bridge timeout, carrier restart): the node
      // may have the transaction and the runtime may have recorded it.
      throw new OneKeyLocalError(
        localWalletText(ETranslations.privacy_error_broadcast_unknown__msg),
      );
    }

    const {
      txid,
      broadcast,
      error: broadcastError,
    } = JSON.parse(raw) as {
      txid: string;
      broadcast?: 'accepted' | 'unknown';
      error?: unknown;
    };
    if (broadcast === 'unknown') {
      // Recorded as pending: a later scan confirms it, or the pending check
      // marks it failed and frees its inputs if the node never had it.
      console.warn('[xmr] broadcast outcome unknown; recorded as pending', {
        txid,
        error: broadcastError,
      });
    }
    if (signedTx.txid && txid !== signedTx.txid) {
      // The txid is fixed at signing. A different one back means the runtime
      // broadcast something other than what was signed.
      throw new OneKeyLocalError(
        `xmr: broadcast returned an unexpected transaction id (signed ${signedTx.txid}, broadcast ${txid})`,
      );
    }

    // Only chance to record the recipient (chain carries none); never let
    // this failure make an already-successful broadcast look like it failed.
    try {
      await this.backgroundApi.simpleDb.xmr.recordSentRecipient({
        accountId: this.accountId,
        txid,
        recipient: encodedTx.to,
        amountAtomic: encodedTx.amountAtomic,
        feeAtomic: encodedTx.feeAtomic,
        ...(broadcast === 'unknown' ? { broadcastOutcomeUnknown: true } : {}),
      });
    } catch (error) {
      console.error(
        '[xmr] could not record the recipient; the send itself succeeded',
        {
          txid,
          error,
        },
      );
    }

    return {
      ...signedTx,
      txid,
      encodedTx,
      broadcastOutcomeUnknown: broadcast === 'unknown',
    };
  }

  /**
   * Distinguishes "never scanned" (zero) from "can't answer right now"
   * (`''`, read as unknown) - a scan merely behind still reports what it's seen.
   */
  private async xmrGetBalanceForDisplay(): Promise<{
    total: string;
    totalParsed: string;
    spendable: string;
    spendableParsed: string;
    balanceStatus: IBalanceStatus;
  }> {
    const unknown = {
      total: '',
      totalParsed: '',
      spendable: '',
      spendableParsed: '',
    };
    try {
      const capability = this.getLocalWalletCapability();
      const state = await capability.getAccountState({
        accountId: this.accountId,
      });
      // Never scanned is not a known zero, and paused privacy hides the
      // private balance (all of Monero's): blank, and left out of totals.
      if (!state.enabled) {
        return { ...unknown, balanceStatus: 'notEnabled' };
      }
      const balance = await capability.getAccountBalance({
        accountId: this.accountId,
      });
      if (!balance?.total || !balance.totalParsed) {
        return { ...unknown, balanceStatus: 'unavailable' };
      }
      const progress = state.enabled
        ? await capability
            .getSyncProgress({ accountId: this.accountId })
            .catch(() => undefined)
        : undefined;
      const spendable = balance.spendable ?? balance.total;
      // Saved earlier, or the scan has not reached the tip yet.
      const isStale = balance.balanceStatus === 'partial';
      const isBackfilling = !!progress && !progress.isBackfillComplete;
      return {
        total: balance.total,
        totalParsed: balance.totalParsed,
        spendable,
        spendableParsed: new BigNumber(spendable)
          .shiftedBy(-XMR_DECIMALS)
          .toFixed(),
        balanceStatus: isStale || isBackfilling ? 'partial' : 'complete',
      };
    } catch (error) {
      // A balance read must never take down the account page. The scanner
      // being unavailable is a state, not a crash.
      console.error('[xmr] balance unavailable', { error });
      return { ...unknown, balanceStatus: 'unavailable' };
    }
  }

  // `balance` is spendable-now (as on BTC); the dialog shows it beside total
  // and the frozen remainder (locked, pending change, or unverifiable).
  override async fetchAccountDetails(
    params: IFetchServerAccountDetailsParams,
  ): Promise<IFetchServerAccountDetailsResponse> {
    const { total, totalParsed, spendable, spendableParsed } =
      await this.xmrGetBalanceForDisplay();
    const known = total !== '' && spendable !== '';
    const frozen = known
      ? BigNumber.max(new BigNumber(total).minus(spendable), 0).toFixed()
      : '';
    return {
      data: {
        data: {
          address: params.accountAddress,
          balance: spendable,
          balanceParsed: spendableParsed,
          totalBalance: total,
          totalBalanceParsed: totalParsed,
          frozenBalance: frozen,
          frozenBalanceParsed: known
            ? new BigNumber(frozen).shiftedBy(-XMR_DECIMALS).toFixed()
            : '',
        },
      },
    };
  }

  /**
   * Synthesizes the native token row: `backendIndex: false` means no server
   * list to merge with, so without this the account page shows no XMR row.
   */
  override async fetchTokenList(
    params: IFetchServerTokenListParams,
  ): Promise<IFetchServerTokenListResponse> {
    const network = await this.getNetwork();
    const { total, totalParsed, balanceStatus } =
      await this.xmrGetBalanceForDisplay();
    const { networkId, accountAddress } = params.requestApiParams;
    return buildLocalWalletNativeTokenList({
      network,
      networkId,
      accountAddress,
      balance: total,
      balanceParsed: totalParsed,
      balanceStatus,
    });
  }

  // `balance` is spendable (unlocked); total and the locked rest ride
  // alongside, matching wallet2's balance/unlocked-balance split.
  override async fetchTokenDetails(
    _params: IFetchServerTokenDetailParams,
  ): Promise<IFetchServerTokenDetailResponse> {
    const network = await this.getNetwork();
    const { total, totalParsed, spendable, spendableParsed, balanceStatus } =
      await this.xmrGetBalanceForDisplay();
    const known = total !== '' && spendable !== '';
    const frozen = known
      ? BigNumber.max(new BigNumber(total).minus(spendable), 0).toFixed()
      : '';
    return {
      data: {
        data: [
          {
            balanceStatus,
            info: {
              address: '',
              decimals: network.decimals,
              name: network.name,
              symbol: network.symbol,
              logoURI: network.logoURI,
              isNative: true,
            },
            balance: spendable,
            balanceParsed: spendableParsed,
            frozenBalance: frozen,
            frozenBalanceParsed: known
              ? new BigNumber(frozen).shiftedBy(-XMR_DECIMALS).toFixed()
              : '',
            totalBalance: total,
            totalBalanceParsed: totalParsed,
            price: 0,
            price24h: 0,
            fiatValue: spendable === '0' ? '0' : '',
          },
        ],
      },
    };
  }

  /**
   * Local scan is the only history source; `undefined` falls back to cached
   * rows instead of sending the account's address to the server API.
   */
  override async fetchAccountHistoryFromLocal(params: {
    accountId: string;
    networkId: string;
    accountAddress: string;
    xpub?: string;
  }): Promise<IAccountHistoryTx[] | undefined> {
    const accountId = params.accountId || this.accountId;
    const items = await this.xmrListHistoryItems({ accountId });
    if (!items) {
      return loadCachedLocalWalletHistory({
        backgroundApi: this.backgroundApi,
        networkId: params.networkId,
        accountAddress: params.accountAddress,
        xpub: params.xpub,
      });
    }

    const [account, nativeToken, recipients, sentAmounts, progress] =
      await Promise.all([
        this.getAccount(),
        this.backgroundApi.serviceToken.getNativeToken({
          networkId: this.networkId,
          accountId,
        }),
        this.backgroundApi.simpleDb.xmr.getSentRecipients({ accountId }),
        this.backgroundApi.simpleDb.xmr.getSentAmounts({ accountId }),
        this.backgroundApi.servicePrivacyChain
          .getLocalWalletSyncProgress({ networkId: this.networkId, accountId })
          .catch(() => undefined),
      ]);

    return Promise.all(
      items.map((item) =>
        buildXmrLocalHistoryTx({
          item,
          chainTip: progress?.chainTip,
          ownAddress: account.address,
          recipient: recipients[item.txid],
          sentAmount: sentAmounts[item.txid],
          nativeToken,
          networkId: this.networkId,
          accountId,
          accountAddress: params.accountAddress,
          buildTransferAction: (p) => this.buildTxTransferAssetAction(p),
        }),
      ),
    );
  }

  /**
   * `undefined` vs `[]` matters: `[]` is an authoritative "no transactions"
   * (clears stale cache); `undefined` falls back to cache instead of wiping it.
   */
  private async xmrListHistoryItems({
    accountId,
  }: {
    accountId: string;
  }): Promise<IXmrHistoryItem[] | undefined> {
    try {
      // UI read: answers with rows last seen (or `undefined`) while a scan
      // step holds the runtime, never queued behind it.
      return await readXmrStaleFirst({
        key: `history:${accountId}`,
        fallback: undefined,
        read: async () => {
          const api = await getXmrLocalRuntime(this);
          const identityId = await getXmrIdentityId({ api, accountId });
          // All of it: the cached list is replaced by what this returns, so a
          // single page would delete every older row from the cache.
          const items: IXmrHistoryItem[] = [];
          for (;;) {
            // eslint-disable-next-line no-await-in-loop
            const page = JSON.parse(
              await api.history(
                identityId,
                XMR_HISTORY_PAGE_SIZE,
                items.length,
              ),
            ) as { items: IXmrHistoryItem[]; total: number };
            items.push(...page.items);
            if (page.items.length === 0 || items.length >= page.total) break;
          }
          return items;
        },
      });
    } catch (error) {
      console.error('[xmr] history unavailable', { error });
      return undefined;
    }
  }

  // Default asks the backend with the account's address; refused here since
  // the address must not leave the device and Monero has nothing to add.
  override async fetchAccountHistoryDetail(): Promise<never> {
    throw new OneKeyLocalError('xmr: transaction details are local only');
  }

  // signableHex holds the view key; tagged private so it never reaches the
  // shared local-history cache (SimpleDbEntityLocalHistory refuses it).
  override async buildHistoryTx(
    params: Parameters<VaultBase['buildHistoryTx']>[0],
  ): Promise<IAccountHistoryTx> {
    const historyTx = await super.buildHistoryTx(params);
    return { ...historyTx, privacyChainHistorySide: 'private' };
  }

  /**
   * Checked through the scanner's own request channel, so a pass here means
   * the scanner can reach it; plain http works on desktop/extension only.
   */
  override async getCustomRpcEndpointStatus(
    params: IMeasureRpcStatusParams,
  ): Promise<IMeasureRpcStatusResult> {
    const base = params.rpcUrl.trim().replace(/\/+$/, '');
    const { protocol } = new URL(base);
    if (protocol !== 'https:' && protocol !== 'http:') {
      throw new OneKeyLocalError('xmr: the node must be http or https');
    }
    if (protocol === 'http:' && platformEnv.isWeb) {
      throw new OneKeyLocalError('xmr: this platform needs an https node');
    }
    // Same path join as the runtime's transport.
    const url = `${base}/get_height`;
    const start = Date.now();
    let text: string;
    try {
      if (xmrHostFetch) {
        text = bufferUtils.bytesToUtf8(
          await xmrHostFetch(url, 'application/json', new Uint8Array()),
        );
      } else {
        const response = await fetch(url, { method: 'POST' });
        if (!response.ok) {
          throw new OneKeyLocalError(
            localWalletText(ETranslations.privacy_error_node_unreachable__msg),
          );
        }
        text = await response.text();
      }
    } catch (error) {
      // The app's transport policy blocks cleartext on phones (iOS allows only
      // the local network), which surfaces as a bare network error.
      if (protocol === 'http:' && platformEnv.isNative) {
        throw new OneKeyLocalError('xmr: this platform needs an https node');
      }
      throw error;
    }
    const body = JSON.parse(text) as { height?: number };
    if (typeof body.height !== 'number' || body.height <= 0) {
      throw new OneKeyLocalError(
        localWalletText(ETranslations.privacy_error_node_unreachable__msg),
      );
    }
    return {
      responseTime: Date.now() - start,
      bestBlockNumber: body.height,
    };
  }

  // Monero has no xpub: an account is a key pair plus subaddresses derived
  // from it, not a hierarchy a third party can walk.
  override validateXpub(_xpub: string): Promise<IXpubValidation> {
    return Promise.resolve({ isValid: false });
  }

  override validateXprvt(_xprvt: string): Promise<IXprvtValidation> {
    return Promise.resolve({ isValid: false });
  }

  override getPrivateKeyFromImported(
    _params: IGetPrivateKeyFromImportedParams,
  ): Promise<IGetPrivateKeyFromImportedResult> {
    throw new NotImplemented();
  }

  override validatePrivateKey(
    _privateKey: string,
  ): Promise<IPrivateKeyValidation> {
    return Promise.resolve({ isValid: false });
  }

  override async validateGeneralInput(
    params: IValidateGeneralInputParams,
  ): Promise<IGeneralInputValidation> {
    const { result } = await this.baseValidateGeneralInput(params);
    return result;
  }
}
