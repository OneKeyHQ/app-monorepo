// cspell:ignore subaddresses
import BigNumber from 'bignumber.js';
import { isEmpty } from 'lodash';

import { parseXmrKeyImageTransfers } from '@onekeyhq/core/src/chains/xmr/deviceKeyImages';
import { readXmrRuntimeError } from '@onekeyhq/core/src/chains/xmr/sdkXmrRuntime';
import type { IXmrRuntimeApi } from '@onekeyhq/core/src/chains/xmr/sdkXmrRuntime';
import { xmrHostFetch } from '@onekeyhq/core/src/chains/xmr/sdkXmrRuntime/sdk/hostFetch';
import type { IXmrNetwork } from '@onekeyhq/core/src/chains/xmr/sdkXmrRuntime/types';
import {
  getXmrReviewRequest,
  parseXmrPreparedDeviceTransaction,
  parseXmrPreparedTransaction,
  parseXmrSendRequest,
  parseXmrTransaction,
} from '@onekeyhq/core/src/chains/xmr/transactionReview';
import { parseXmrViewingKeyPair } from '@onekeyhq/core/src/chains/xmr/viewingKeys';
import type { IXmrViewingKeyPair } from '@onekeyhq/core/src/chains/xmr/viewingKeys';
import type { ISignedTxPro, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { getPrivacyChainRuntimeFailure } from '@onekeyhq/core/src/utils/privacyChainWorkerClient';
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
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { gateLocalWalletHistoryTx } from '@onekeyhq/shared/src/utils/privacyChainHistoryAddressGate';
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
import { EHardwareCallContext } from '@onekeyhq/shared/types/device';
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
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';
import {
  EDecodedTxActionType,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';
import type { IDecodedTx, IDecodedTxAction } from '@onekeyhq/shared/types/tx';

import { VaultBase } from '../../base/VaultBase';
import { getLocalWalletHistoryAddressGate } from '../../localWallet/historyAddressGate';
import { localWalletText } from '../../localWallet/messages';
import { fetchLocalWalletNativeTokenPrice } from '../../localWallet/nativeTokenPrice';
import {
  isLocalWalletCacheEpochCurrent,
  readLocalWalletCacheEpoch,
} from '../../localWallet/privacyChainCacheStore';
import {
  buildLocalWalletNativeTokenList,
  getLocalWalletFiatValue,
  localWalletBalanceUnavailableError,
} from '../../localWallet/tokenList';
import { getViewingKeyFingerprint } from '../../localWallet/viewingKeyFingerprint';
import { getLocalWalletViewingKey } from '../../localWallet/viewingKeyStore';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { getXmrLifecycleMutex } from './lifecycle';
import {
  buildXmrLocalHistoryDetail,
  buildXmrLocalHistoryTx,
  toXmrSentAmount,
} from './localHistory';
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
import type {
  ILocalWalletAccountBalance,
  ILocalWalletCapability,
} from '../../localWallet/types';
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

async function postXmrNodeRequest(url: string): Promise<string> {
  if (xmrHostFetch) {
    return bufferUtils.bytesToUtf8(
      await xmrHostFetch(url, 'application/json', new Uint8Array()),
    );
  }
  const response = await fetch(url, { method: 'POST' });
  if (!response.ok) {
    throw new OneKeyLocalError(
      localWalletText(ETranslations.privacy_error_node_unreachable__msg),
    );
  }
  return response.text();
}

const XMR_NODE_NETWORKS: readonly string[] = [
  'mainnet',
  'stagenet',
  'testnet',
  'fakechain',
];

// Undefined when the node does not say: partial proxies may not serve /get_info.
async function readXmrNodeNetwork(url: string): Promise<string | undefined> {
  try {
    const info = JSON.parse(await postXmrNodeRequest(url)) as Record<
      string,
      unknown
    >;
    if (
      typeof info.nettype === 'string' &&
      XMR_NODE_NETWORKS.includes(info.nettype)
    ) {
      return info.nettype;
    }
    return XMR_NODE_NETWORKS.find((name) => info[name] === true);
  } catch {
    return undefined;
  }
}

function toXmrUserFacingError(error: unknown): unknown {
  if (getPrivacyChainRuntimeFailure(error)) {
    return new OneKeyLocalError(
      localWalletText(ETranslations.privacy_error_runtime_unavailable__msg),
    );
  }
  const runtime = readXmrRuntimeError(error);
  if (!runtime) return error;
  // `detail` is untranslated, log-only, but the only clue to why a node failed.
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

/** Prepare -> sign -> broadcast, since the fee depends on the built transaction weight. */
export default class Vault extends VaultBase {
  override keyringMap: Record<IDBWalletType, typeof KeyringBase | undefined> = {
    hd: KeyringHd,
    // No watch-only: detecting spends needs key images, which need the spend key.
    watching: undefined,
    imported: undefined,
    hw: KeyringHardware,
    qr: undefined,
    external: undefined,
  };

  /** The account viewing pair (`spendPub:viewPriv`) from the privacy-chain viewing key store; derivation belongs to the service authorization path, never a read. */
  async getXmrViewingKeys({
    accountId,
  }: {
    accountId: string;
  }): Promise<IXmrViewingKeyPair & { primaryAddress: string; vkFp: string }> {
    const [account, stored] = await Promise.all([
      this.backgroundApi.serviceAccount.getAccount({
        accountId,
        networkId: this.networkId,
      }),
      getLocalWalletViewingKey({
        backgroundApi: this.backgroundApi,
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
      vkFp: getViewingKeyFingerprint({
        networkId: this.networkId,
        viewingKey: stored.value,
      }),
      ...parseXmrViewingKeyPair(stored.value),
    };
  }

  async getXmrNetwork(): Promise<IXmrNetwork> {
    const network = await this.getNetwork();
    return network.isTestnet ? 'testnet' : 'mainnet';
  }

  // An enabled custom node wins; otherwise the built-in one, so turning a
  // custom node off never stops sync.
  async resolveXmrNodeUrl(): Promise<string> {
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
    // Network-scoped: a cross-network address is unspendable, not just wrong.
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

  // Must be synced before building: an unscanned block may already have spent the outputs this send would pick.
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
    // A swap route instruction cannot be carried; never pay without it.
    if (transferInfo.memo || transferInfo.opReturn) {
      throw new OneKeyLocalError(
        'Monero swap route instructions are not supported',
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

  // A saved request cannot send until the runtime has applied its scan target.
  private async xmrPreparedEpoch(): Promise<string> {
    const state =
      await this.backgroundApi.simpleDb.privacyChainState.getXmrAccountState({
        accountId: this.accountId,
      });
    if (
      state.deletionPending ||
      state.intent !== 'on' ||
      state.operation !== undefined ||
      state.epoch === undefined ||
      state.appliedEpoch !== state.epoch
    ) {
      throw new OneKeyLocalError(
        localWalletText(ETranslations.privacy_error_review_expired__msg),
      );
    }
    return state.epoch;
  }

  /** Built at review time, not signing, so the confirmed fee/amount cannot drift from what is signed. */
  private async xmrPrepareTransaction(
    encodedTx: IEncodedTxXmr,
  ): Promise<IEncodedTxXmr> {
    const privacyEpoch = await this.xmrPreparedEpoch();
    const api = await this.getXmrRuntimeApi();
    const identityId = await getXmrIdentityId({
      api,
      vault: this,
      accountId: this.accountId,
    });
    await this.xmrEnsureKeyImages({ api, identityId });
    const chainTip = await getXmrChainTip(api);

    // A hardware account gets a plan instead: the device builds the outputs.
    const isDevice = this.keyring instanceof KeyringHardware;
    const prepareArgs = [
      identityId,
      stringUtils.stableStringify([
        { address: encodedTx.to, amountAtomic: encodedTx.amountAtomic },
      ]),
      encodedTx.isMaxSend === true,
      String(chainTip),
      encodedTx.priority,
    ] as const;
    let raw: string;
    try {
      raw = isDevice
        ? await api.prepareDeviceTransaction(...prepareArgs)
        : await api.prepareTransaction(...prepareArgs);
    } catch (error) {
      throw toXmrUserFacingError(error);
    }

    const result = isDevice
      ? parseXmrPreparedDeviceTransaction(JSON.parse(raw))
      : parseXmrPreparedTransaction(JSON.parse(raw));
    if ((await this.xmrPreparedEpoch()) !== privacyEpoch) {
      throw new OneKeyLocalError(
        localWalletText(ETranslations.privacy_error_review_expired__msg),
      );
    }
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
      privacyEpoch,
    });
  }

  /** Confirms real spends via key images; the runtime reduces the spend key from the BIP-32 key for this call only. */
  async xmrImportKeyImages({ password }: { password: string }): Promise<{
    imported: number;
    spendsFound: number;
  }> {
    if (!(this.keyring instanceof KeyringHd)) {
      throw new NotImplemented();
    }
    const bip32PrivateKeyHex =
      await this.keyring.xmrGetKeyImageBip32PrivateKeyHex({ password });
    const api = await this.getXmrRuntimeApi();
    const identityId = await getXmrIdentityId({
      api,
      vault: this,
      accountId: this.accountId,
    });
    return JSON.parse(
      await api.importKeyImagesWithBip32Key(identityId, bip32PrivateKeyHex),
    ) as { imported: number; spendsFound: number };
  }

  override async localWalletHasPasswordWork(): Promise<boolean> {
    if (!(this.keyring instanceof KeyringHd)) return false;
    const api = await this.getXmrRuntimeApi();
    const identityId = await getXmrIdentityId({
      api,
      vault: this,
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
    return imported > 0 || spendsFound > 0;
  }

  // A hardware account's spend key stays on the device, which computes the key
  // images instead; the runtime verifies each before using it.
  async xmrImportKeyImagesFromDevice({
    deviceParams,
  }: {
    deviceParams: IDeviceSharedCallParams;
  }): Promise<{ imported: number; spendsFound: number }> {
    if (!(this.keyring instanceof KeyringHardware)) {
      throw new NotImplemented();
    }
    const api = await this.getXmrRuntimeApi();
    const identityId = await getXmrIdentityId({
      api,
      vault: this,
      accountId: this.accountId,
    });
    const transfers = parseXmrKeyImageTransfers(
      await api.exportKeyImageSyncData(identityId),
    );
    if (!transfers.length) return { imported: 0, spendsFound: 0 };
    const keyImages = await this.keyring.xmrGetKeyImagesFromDevice({
      deviceParams,
      transfers,
    });
    return JSON.parse(
      await api.importDeviceKeyImages(
        identityId,
        stringUtils.stableStringify(
          transfers.map(({ outputId }, index) => ({
            outputId,
            ...keyImages[index],
          })),
        ),
      ),
    ) as { imported: number; spendsFound: number };
  }

  override async localWalletHasDeviceWork(): Promise<boolean> {
    if (!(this.keyring instanceof KeyringHardware)) return false;
    const api = await this.getXmrRuntimeApi();
    const identityId = await getXmrIdentityId({
      api,
      vault: this,
      accountId: this.accountId,
    });
    return (await this.xmrCountOutputsWithoutKeyImage({ api, identityId })) > 0;
  }

  override async localWalletDoDeviceWork({
    deviceParams,
  }: {
    deviceParams: IDeviceSharedCallParams;
  }): Promise<boolean> {
    const { imported, spendsFound } = await this.xmrImportKeyImagesFromDevice({
      deviceParams,
    });
    return imported > 0 || spendsFound > 0;
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
    const isHardware = this.keyring instanceof KeyringHardware;
    if (!(this.keyring instanceof KeyringHd) && !isHardware) return;
    if (!(await this.xmrCountOutputsWithoutKeyImage({ api, identityId }))) {
      return;
    }
    if (isHardware) {
      const deviceParams = checkIsDefined(
        await this.backgroundApi.serviceAccount.getWalletDeviceParams({
          walletId: accountUtils.getWalletIdFromAccountId({
            accountId: this.accountId,
          }),
          hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
        }),
      );
      await this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
        () => this.xmrImportKeyImagesFromDevice({ deviceParams }),
        { deviceParams, debugMethodName: 'xmr.syncKeyImagesBeforeSend' },
      );
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
      isPsbt: true,
      totalFeeInNative: new BigNumber(encodedTx.feeAtomic || '0')
        .shiftedBy(-network.feeMeta.decimals)
        .toFixed(),
      nativeAmount: encodedTx.amount,
      nativeAmountValue: encodedTx.amountAtomic,
    };
  }

  /** Nothing is adjustable after build: editing would invalidate `signableHex`. */
  override updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    return Promise.resolve(params.unsignedTx);
  }

  /** Fee read off the built transaction; no estimate fallback, since a wrong fee is worse than none. */
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

  override async broadcastTransactionFromCustomRpc(
    params: IBroadcastTransactionByCustomRpcParams,
  ): Promise<ISignedTxPro> {
    const { customRpcInfo: _customRpcInfo, ...rest } = params;
    return this.broadcastTransaction(rest);
  }

  /** Irreversible. Outputs are marked spent and the tx recorded together; a network error is recorded as pending so a resend cannot pay twice. */
  override async broadcastTransaction(
    params: IBroadcastTransactionParams,
  ): Promise<ISignedTxPro> {
    const { signedTx } = params;
    const encodedTx = signedTx.encodedTx as IEncodedTxXmr | undefined;
    const wasBuilt = Boolean(
      encodedTx?.signableHex || encodedTx?.devicePlanJson,
    );
    if (!encodedTx || !wasBuilt || !signedTx.rawTx) {
      throw new OneKeyLocalError(
        localWalletText(ETranslations.privacy_error_review_expired__msg),
      );
    }

    const reviewed = parseXmrTransaction(encodedTx);
    // A device-built transaction is verified against its plan: the device
    // drew its own output keys, so they cannot be re-derived from a signable.
    const signable =
      reviewed.devicePlanJson === undefined
        ? reviewed.signableHex
        : reviewed.devicePlanJson;
    const reviewJson = stringUtils.stableStringify(
      getXmrReviewRequest(reviewed, await this.getXmrNetwork()),
    );
    const api = await this.getXmrRuntimeApi();
    let verifiedTxid: string;
    try {
      verifiedTxid = await api.verifySignedTransaction(
        signable,
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
      vault: this,
      accountId: this.accountId,
    });

    const raw = await getXmrLifecycleMutex(this.networkId).runExclusive(
      async () => {
        if ((await this.xmrPreparedEpoch()) !== reviewed.privacyEpoch) {
          throw new OneKeyLocalError(
            localWalletText(ETranslations.privacy_error_review_expired__msg),
          );
        }
        try {
          return await api.broadcastTransaction(
            identityId,
            signedTx.rawTx,
            String(reviewed.chainTip),
            new BigNumber(reviewed.amountAtomic)
              .plus(reviewed.feeAtomic)
              .toFixed(),
            reviewed.changeAtomic,
            signable,
            reviewJson,
          );
        } catch (error) {
          console.error('[xmr] broadcast failed', {
            txid: signedTx.txid,
            error,
          });
          if (readXmrRuntimeError(error)) throw toXmrUserFacingError(error);
          // A lost call may already have been recorded and sent by the Worker.
          throw new OneKeyLocalError(
            localWalletText(ETranslations.privacy_error_broadcast_unknown__msg),
          );
        }
      },
    );

    const {
      txid,
      broadcast,
      error: broadcastError,
    } = JSON.parse(raw) as {
      txid: string;
      broadcast?: 'accepted' | 'unknown';
      error?: unknown;
    };
    if (signedTx.txid && txid !== signedTx.txid) {
      // The txid is fixed at signing; a different one back means something else was broadcast.
      throw new OneKeyLocalError(
        `xmr: broadcast returned an unexpected transaction id (signed ${signedTx.txid}, broadcast ${txid})`,
      );
    }

    // Only chance to record the recipient (chain carries none); never let
    // this failure make an already-successful broadcast look like it failed.
    try {
      await this.backgroundApi.simpleDb.privacyChainXmrSent.recordXmrSent({
        accountId: this.accountId,
        txid,
        recipient: encodedTx.to,
        amountAtomic: encodedTx.amountAtomic,
        feeAtomic: encodedTx.feeAtomic,
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

    if (broadcast === 'unknown') {
      // Fails like BTC. The runtime keeps the tx pending: a later scan
      // confirms it, or the pending check frees its inputs.
      console.error('[xmr] broadcast outcome unknown', {
        txid,
        error: broadcastError,
      });
      throw new OneKeyLocalError(
        localWalletText(ETranslations.privacy_error_broadcast_unknown__msg),
      );
    }

    return { ...signedTx, txid, encodedTx };
  }

  // Not enabled is a known zero. Enabled but unreadable (setting up, deleting,
  // rescanning, runtime down) throws, so pages keep the balance they show.
  private async xmrGetBalanceForDisplay(): Promise<{
    total: string;
    totalParsed: string;
    spendable: string;
    spendableParsed: string;
  }> {
    let balance: ILocalWalletAccountBalance | null;
    try {
      const capability = this.getLocalWalletCapability();
      const state = await capability.getAccountState({
        accountId: this.accountId,
      });
      if (!state.enabled && !state.paused && !state.pendingOperation) {
        return {
          total: '0',
          totalParsed: '0',
          spendable: '0',
          spendableParsed: '0',
        };
      }
      balance = await capability.getAccountBalance({
        accountId: this.accountId,
      });
    } catch (error) {
      console.error('[xmr] balance unavailable', { error });
      balance = null;
    }
    if (!balance?.total || !balance.totalParsed) {
      throw localWalletBalanceUnavailableError('xmr');
    }
    const spendable = balance.spendable ?? balance.total;
    return {
      total: balance.total,
      totalParsed: balance.totalParsed,
      spendable,
      spendableParsed: new BigNumber(spendable)
        .shiftedBy(-XMR_DECIMALS)
        .toFixed(),
    };
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

  /** Synthesizes the native token row: with `backendIndex: false` there is no server list to merge, so the account page would show no XMR row. */
  override async fetchTokenList(
    params: IFetchServerTokenListParams,
  ): Promise<IFetchServerTokenListResponse> {
    const network = await this.getNetwork();
    const [{ total, totalParsed }, price] = await Promise.all([
      this.xmrGetBalanceForDisplay(),
      this.xmrGetNativeTokenPrice(params.requestCurrency),
    ]);
    const { networkId, accountAddress } = params.requestApiParams;
    return buildLocalWalletNativeTokenList({
      network,
      networkId,
      accountAddress,
      balance: total,
      balanceParsed: totalParsed,
      price,
    });
  }

  // Never through an account-scoped endpoint: the address stays on device.
  private async xmrGetNativeTokenPrice(
    requestCurrency?: string,
  ): Promise<number | undefined> {
    return fetchLocalWalletNativeTokenPrice({
      backgroundApi: this.backgroundApi,
      networkId: this.networkId,
      requestCurrency,
    });
  }

  override async fetchTokenDetails(
    params: IFetchServerTokenDetailParams,
  ): Promise<IFetchServerTokenDetailResponse> {
    const network = await this.getNetwork();
    const [{ total, totalParsed, spendable, spendableParsed }, price] =
      await Promise.all([
        this.xmrGetBalanceForDisplay(),
        this.xmrGetNativeTokenPrice(params.requestCurrency),
      ]);
    const known = total !== '' && spendable !== '';
    const frozen = known
      ? BigNumber.max(new BigNumber(total).minus(spendable), 0).toFixed()
      : '';
    const frozenParsed = known
      ? new BigNumber(frozen).shiftedBy(-XMR_DECIMALS).toFixed()
      : '';
    return {
      data: {
        data: [
          {
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
            frozenBalanceParsed: frozenParsed,
            totalBalance: total,
            totalBalanceParsed: totalParsed,
            price: price ?? 0,
            price24h: 0,
            fiatValue: getLocalWalletFiatValue({
              amountParsed: spendableParsed,
              price,
            }),
            frozenBalanceFiatValue: getLocalWalletFiatValue({
              amountParsed: frozenParsed,
              price,
            }),
            totalBalanceFiatValue: getLocalWalletFiatValue({
              amountParsed: totalParsed,
              price,
            }),
          },
        ],
      },
    };
  }

  /** Local scan is the only history source; `undefined` falls back to cached rows rather than sending the address to the server API. */
  override async fetchAccountHistoryFromLocal(params: {
    accountId: string;
    networkId: string;
    accountAddress: string;
    xpub?: string;
  }): Promise<IAccountHistoryTx[] | undefined> {
    const txs = await this.xmrBuildHistoryTxs(params);
    if (!txs?.length) return txs;
    const gate = await getLocalWalletHistoryAddressGate({
      backgroundApi: this.backgroundApi,
      networkId: params.networkId,
      accountId: params.accountId || this.accountId,
    });
    return txs.map((tx) => gateLocalWalletHistoryTx(gate, tx));
  }

  private async xmrBuildHistoryTxs(params: {
    accountId: string;
    networkId: string;
    accountAddress: string;
    xpub?: string;
  }): Promise<IAccountHistoryTx[] | undefined> {
    const accountId = params.accountId || this.accountId;
    if (await this.xmrIsHistoryNeverEnabled(accountId)) return [];
    const items = await this.xmrListHistoryItems({ accountId });
    // Failed, or busy with nothing read yet: as a failed backend fetch does,
    // so the page keeps the rows it has.
    if (!items) throw new OneKeyLocalError('xmr: history unavailable');

    const [account, nativeToken, sentRecords, progress] = await Promise.all([
      this.getAccount(),
      this.backgroundApi.serviceToken.getNativeToken({
        networkId: this.networkId,
        accountId,
      }),
      this.backgroundApi.simpleDb.privacyChainXmrSent.listXmrSent({
        accountId,
      }),
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
          recipient: sentRecords[item.txid]?.recipient,
          sentAmount: toXmrSentAmount(sentRecords[item.txid]),
          nativeToken,
          networkId: this.networkId,
          accountId,
          accountAddress: params.accountAddress,
          buildTransferAction: (p) => this.buildTxTransferAssetAction(p),
        }),
      ),
    );
  }

  // Paused accounts keep their scanned rows and still read them. A failed
  // state read is not proof of "never", so it keeps the runtime read.
  private async xmrIsHistoryNeverEnabled(accountId: string): Promise<boolean> {
    try {
      const state =
        await this.backgroundApi.simpleDb.privacyChainState.getXmrAccountState({
          accountId,
        });
      return state.intent !== 'on' && state.resumeFromHeight === undefined;
    } catch {
      return false;
    }
  }

  private async xmrListHistoryItems({
    accountId,
  }: {
    accountId: string;
  }): Promise<IXmrHistoryItem[] | undefined> {
    try {
      const epoch = await readLocalWalletCacheEpoch({
        backgroundApi: this.backgroundApi,
        accountId,
      });
      // UI read: answers with rows last seen (or `undefined`) while a scan
      // step holds the runtime, never queued behind it.
      return await readXmrStaleFirst({
        key: `history:${accountId}`,
        fallback: undefined,
        queueWhenUncached: true,
        owner: {
          epoch,
          isCurrent: () =>
            isLocalWalletCacheEpochCurrent({
              backgroundApi: this.backgroundApi,
              accountId,
              epoch,
            }),
        },
        read: async () => {
          const api = await getXmrLocalRuntime(this);
          const identityId = await getXmrIdentityId({
            api,
            vault: this,
            accountId,
          });
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

  // Answered from the scanned rows, never the backend: the address must not
  // leave the device. Not found throws, which the caller reads as no detail.
  override async fetchAccountHistoryDetail(
    params: IServerFetchAccountHistoryDetailParams,
  ): Promise<IServerFetchAccountHistoryDetailResp> {
    const accountId = params.accountId || this.accountId;
    const item = (await this.xmrIsHistoryNeverEnabled(accountId))
      ? undefined
      : (await this.xmrListHistoryItems({ accountId }))?.find(
          (row) => row.txid === params.txid,
        );
    if (!item) {
      throw new OneKeyLocalError('xmr: transaction not found locally');
    }
    const [progress, recipient] = await Promise.all([
      this.backgroundApi.servicePrivacyChain
        .getLocalWalletSyncProgress({ networkId: this.networkId, accountId })
        .catch(() => undefined),
      // Only for its payment ID; the detail stands without it.
      item.direction === 'out'
        ? this.backgroundApi.simpleDb.privacyChainXmrSent
            .listXmrSent({ accountId })
            .then((records) => records[item.txid]?.recipient)
            .catch(() => undefined)
        : undefined,
    ]);
    return {
      data: {
        data: {
          data: buildXmrLocalHistoryDetail({
            item,
            chainTip: progress?.chainTip,
            recipient,
          }),
          tokens: {},
          nfts: {},
        },
      },
    };
  }

  // signableHex holds the view key; tagged private so it never reaches the
  // shared local-history cache (SimpleDbEntityLocalHistory refuses it).
  override async buildHistoryTx(
    params: Parameters<VaultBase['buildHistoryTx']>[0],
  ): Promise<IAccountHistoryTx> {
    const historyTx = await super.buildHistoryTx(params);
    return { ...historyTx, privacyChainHistorySide: 'private' };
  }

  /** Checked through the scanner request channel; plain http works on desktop/extension only. */
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
    const url = `${base}/get_height`;
    const start = Date.now();
    let text: string;
    try {
      text = await postXmrNodeRequest(url);
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
    const responseTime = Date.now() - start;
    if (params.validateChainId) {
      // Lenient: only a node that names a different network is rejected.
      const nodeNetwork = await readXmrNodeNetwork(`${base}/get_info`);
      if (nodeNetwork && nodeNetwork !== (await this.getXmrNetwork())) {
        throw new OneKeyLocalError('xmr: the node is on a different network');
      }
    }
    return {
      responseTime,
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
