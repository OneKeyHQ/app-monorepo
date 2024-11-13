/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
/* eslint max-classes-per-file: "off" */

import qs from 'querystring';

import BigNumber from 'bignumber.js';
import { isEmpty, isNil, omit, omitBy } from 'lodash';

import type { CoreChainApiBase } from '@onekeyhq/core/src/base/CoreChainApiBase';
import {
  decodeSensitiveText,
  encodeSensitiveText,
} from '@onekeyhq/core/src/secret';
import type {
  IEncodedTx,
  ISignedTxPro,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { NotImplemented } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import chainValueUtils from '@onekeyhq/shared/src/utils/chainValueUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import {
  getOnChainHistoryTxAssetInfo,
  getOnChainHistoryTxStatus,
} from '@onekeyhq/shared/src/utils/historyUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import {
  buildTxActionDirection,
  getStakingActionLabel,
} from '@onekeyhq/shared/src/utils/txActionUtils';
import { addressIsEnsFormat } from '@onekeyhq/shared/src/utils/uriUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type {
  IAddressValidation,
  IFetchAccountDetailsResp,
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
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type {
  IEstimateFeeParams,
  IEstimateGasParams,
  IEstimateGasResp,
  IFeeInfoUnit,
  IServerEstimateFeeResponse,
} from '@onekeyhq/shared/types/fee';
import type {
  IAccountHistoryTx,
  IFetchHistoryTxDetailsResp,
  IOnChainHistoryTx,
  IOnChainHistoryTxApprove,
  IOnChainHistoryTxNFT,
  IOnChainHistoryTxToken,
  IOnChainHistoryTxTransfer,
  IServerFetchAccountHistoryDetailParams,
  IServerFetchAccountHistoryDetailResp,
} from '@onekeyhq/shared/types/history';
import { EOnChainHistoryTxType } from '@onekeyhq/shared/types/history';
import type { IResolveNameResp } from '@onekeyhq/shared/types/name';
import type { ESendPreCheckTimingEnum } from '@onekeyhq/shared/types/send';
import type {
  IFetchServerTokenDetailParams,
  IFetchServerTokenDetailResponse,
  IFetchServerTokenListParams,
  IFetchServerTokenListResponse,
} from '@onekeyhq/shared/types/serverToken';
import type { IStakeTx, IStakingInfo } from '@onekeyhq/shared/types/staking';
import type { ISwapTxInfo } from '@onekeyhq/shared/types/swap/types';
import type {
  IAccountToken,
  IFetchAccountTokensResp,
  IFetchTokenDetailItem,
} from '@onekeyhq/shared/types/token';
import type {
  EReplaceTxType,
  IDecodedTx,
  IDecodedTxAction,
  IDecodedTxActionAssetTransfer,
  IDecodedTxExtraInfo,
  IDecodedTxTransferInfo,
} from '@onekeyhq/shared/types/tx';
import {
  EDecodedTxActionType,
  EDecodedTxDirection,
} from '@onekeyhq/shared/types/tx';

import { VaultContext } from './VaultContext';

import type { KeyringBase } from './KeyringBase';
import type {
  IDBAccount,
  IDBExternalAccount,
  IDBUtxoAccount,
  IDBWalletType,
} from '../../dbs/local/types';
import type {
  IBroadcastTransactionByCustomRpcParams,
  IBroadcastTransactionParams,
  IBuildAccountAddressDetailParams,
  IBuildDecodedTxParams,
  IBuildEncodedTxParams,
  IBuildHistoryTxParams,
  IBuildOkxSwapEncodedTxParams,
  IBuildUnsignedTxParams,
  IGetPrivateKeyFromImportedParams,
  IGetPrivateKeyFromImportedResult,
  INativeAmountInfo,
  ISignTransactionParams,
  IUpdateUnsignedTxParams,
  IValidateGeneralInputParams,
} from '../types';
import type { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';
import type { MessageDescriptor } from 'react-intl';

export type IVaultInitConfig = {
  keyringCreator: (vault: VaultBase) => Promise<KeyringBase>;
};
export type IKeyringMapKey = IDBWalletType;

if (platformEnv.isExtensionUi) {
  debugger;
  throw new Error('engine/VaultBase is not allowed imported from ui');
}

export abstract class VaultBaseChainOnly extends VaultContext {
  coreApi: CoreChainApiBase | undefined;

  async getXpubFromAccount(
    networkAccount: INetworkAccount,
  ): Promise<string | undefined> {
    return (networkAccount as IDBUtxoAccount).xpub;
  }

  // Methods not related to a single account, but implementation.

  async proxyJsonRPCCall<T>(request: IJsonRpcRequest): Promise<T> {
    throw new NotImplemented();
  }

  // **** address parser: dbAddress, baseAddress, displayAddress, utxoAddress, normalizedAddress
  async addressFromBase(account: IDBAccount): Promise<string> {
    throw new NotImplemented();
  }

  async addressToBase(address: string): Promise<string> {
    throw new NotImplemented();
  }
  // async getDisplayAddress(address: string): Promise<string> {

  abstract validateAddress(address: string): Promise<IAddressValidation>;

  abstract validateXpub(xpub: string): Promise<IXpubValidation>;

  abstract validateXprvt(xprvt: string): Promise<IXprvtValidation>;

  abstract validatePrivateKey(
    privateKey: string,
  ): Promise<IPrivateKeyValidation>;

  abstract validateGeneralInput(
    params: IValidateGeneralInputParams,
  ): Promise<IGeneralInputValidation>;

  async baseValidatePrivateKey(
    privateKey: string,
  ): Promise<IPrivateKeyValidation> {
    if (!this.coreApi) {
      throw new Error('coreApi not defined in Vault');
    }
    try {
      const networkInfo = await this.getCoreApiNetworkInfo();
      const result = await this.coreApi.getAddressFromPrivate({
        networkInfo,
        privateKeyRaw: privateKey,
      });
      if (result.publicKey) {
        return {
          isValid: true,
        };
      }
    } catch (error) {
      console.error(error);
    }
    return {
      isValid: false,
    };
  }

  async baseValidateGeneralInput(
    params: IValidateGeneralInputParams,
  ): Promise<{ result: IGeneralInputValidation; inputDecoded: string }> {
    const input = decodeSensitiveText({
      encodedText: params.input,
    });
    const { validateAddress, validateXprvt, validateXpub, validatePrivateKey } =
      params;

    const result: IGeneralInputValidation = { isValid: false };

    let isValid = false;

    let addressResult: IAddressValidation | undefined;
    let xpubResult: IXpubValidation | undefined;
    let xprvtResult: IXprvtValidation | undefined;
    let privateKeyResult: IPrivateKeyValidation | undefined;

    if (validateAddress && !isValid) {
      try {
        addressResult = await this.validateAddress(input);
        result.addressResult = addressResult;
        isValid = isValid || addressResult?.isValid;
      } catch (error) {
        console.error(error);
      }
    }

    if (validateXpub && !isValid) {
      try {
        xpubResult = await this.validateXpub(input);
        result.xpubResult = xpubResult;
        isValid = isValid || xpubResult?.isValid;
      } catch (error) {
        console.error(error);
      }
    }

    if (validateXprvt && !isValid) {
      try {
        xprvtResult = await this.validateXprvt(input);
        result.xprvtResult = xprvtResult;
        isValid = isValid || xprvtResult?.isValid;
      } catch (error) {
        console.error(error);
      }
    }

    if (validatePrivateKey && !isValid) {
      try {
        privateKeyResult = await this.validatePrivateKey(input);
        result.privateKeyResult = privateKeyResult;
        isValid = isValid || privateKeyResult?.isValid;
      } catch (error) {
        console.error(error);
      }
    }

    result.isValid = Boolean(isValid);

    return { result, inputDecoded: input };
  }

  async baseGetPrivateKeyFromImported(
    params: IGetPrivateKeyFromImportedParams,
  ): Promise<IGetPrivateKeyFromImportedResult> {
    const input = decodeSensitiveText({ encodedText: params.input });
    let privateKey = hexUtils.stripHexPrefix(input);
    privateKey = encodeSensitiveText({ text: privateKey });
    return {
      privateKey,
    };
  }

  abstract getPrivateKeyFromImported(
    params: IGetPrivateKeyFromImportedParams,
  ): Promise<IGetPrivateKeyFromImportedResult>;

  async validateAmountInputShown({ toAddress }: { toAddress: string }) {
    return Promise.resolve({
      isValid: true,
    });
  }

  async checkIsDomainName({ name }: { name: string }) {
    return addressIsEnsFormat(name);
  }

  async resolveDomainName({
    name,
  }: {
    name: string;
  }): Promise<IResolveNameResp | null> {
    return null;
  }

  async getCustomRpcEndpointStatus(
    params: IMeasureRpcStatusParams,
  ): Promise<IMeasureRpcStatusResult> {
    throw new NotImplemented();
  }

  async checkFeeSupportInfo(params: IMeasureRpcStatusParams): Promise<{
    isEIP1559FeeEnabled: boolean;
  }> {
    throw new NotImplemented();
  }

  async fetchTokenDetails(
    params: IFetchServerTokenDetailParams,
  ): Promise<IFetchServerTokenDetailResponse> {
    const isCustomNetwork =
      await this.backgroundApi.serviceNetwork.isCustomNetwork({
        networkId: this.networkId,
      });
    if (isCustomNetwork) {
      return this.fetchTokenDetailsByRpc(params);
    }
    return this.fetchTokenDetailsByApi(params);
  }

  async fetchTokenDetailsByApi(
    params: IFetchServerTokenDetailParams,
  ): Promise<IFetchServerTokenDetailResponse> {
    const client = await this.backgroundApi.serviceToken.getClient(
      EServiceEndpointEnum.Wallet,
    );
    const resp = await client.post<{ data: IFetchTokenDetailItem[] }>(
      '/wallet/v1/account/token/search',
      omit(params, ['walletId', 'accountId', 'signal']),
      {
        headers:
          await this.backgroundApi.serviceAccountProfile._getWalletTypeHeader({
            accountId: params.accountId,
            walletId: params.walletId,
          }),
        signal: params.signal ?? undefined,
      },
    );
    return resp;
  }

  async fetchTokenDetailsByRpc(
    params: IFetchServerTokenDetailParams,
  ): Promise<IFetchServerTokenDetailResponse> {
    throw new NotImplemented();
  }
}

// **** more VaultBase: VaultBaseEvmLike, VaultBaseUtxo, VaultBaseVariant
// **** or more interface to implement: IVaultEvmLike, IVaultUtxo, IVaultVariant
export abstract class VaultBase extends VaultBaseChainOnly {
  uuid: string = generateUUID();

  keyring!: KeyringBase;

  abstract keyringMap: Record<IKeyringMapKey, typeof KeyringBase | undefined>;

  async init(config: IVaultInitConfig) {
    await this.initKeyring(config);
  }

  async initKeyring(config: IVaultInitConfig) {
    if (!this.options.isChainOnly) {
      this.keyring = await config.keyringCreator(this);
    }
  }

  abstract buildAccountAddressDetail(
    params: IBuildAccountAddressDetailParams,
  ): Promise<INetworkAccountAddressDetail>;

  abstract buildEncodedTx(params: IBuildEncodedTxParams): Promise<IEncodedTx>;

  abstract buildDecodedTx(params: IBuildDecodedTxParams): Promise<IDecodedTx>;

  abstract buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro>;

  abstract updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro>;

  async broadcastTransaction(
    params: IBroadcastTransactionParams,
  ): Promise<ISignedTxPro> {
    const { signedTx } = params;
    const txid = await this.backgroundApi.serviceSend.broadcastTransaction(
      params,
    );
    return {
      ...signedTx,
      txid,
      encodedTx: signedTx.encodedTx,
    };
  }

  async broadcastTransactionFromCustomRpc(
    params: IBroadcastTransactionByCustomRpcParams,
  ): Promise<ISignedTxPro> {
    throw new NotImplemented();
  }

  async validateSendAmount(params: {
    amount: string;
    tokenBalance: string;
    to: string;
    isNative?: boolean;
  }) {
    return Promise.resolve(true);
  }

  async buildOnChainHistoryTxExtraInfo({
    onChainHistoryTx,
  }: {
    onChainHistoryTx: IOnChainHistoryTx;
  }): Promise<null | IDecodedTxExtraInfo> {
    return null;
  }

  async precheckUnsignedTx(params: {
    unsignedTx: IUnsignedTxPro;
    precheckTiming: ESendPreCheckTimingEnum;
    nativeAmountInfo?: INativeAmountInfo;
    feeInfo?: IFeeInfoUnit;
  }) {
    return Promise.resolve(true);
  }

  async buildEstimateFeeParams({
    encodedTx,
  }: {
    encodedTx: IEncodedTx | undefined;
  }): Promise<{
    encodedTx: IEncodedTx | undefined;
    estimateFeeParams?: IEstimateFeeParams;
  }> {
    return Promise.resolve({
      encodedTx,
    });
  }

  async buildParseTransactionParams({
    encodedTx,
  }: {
    encodedTx: IEncodedTx | undefined;
  }): Promise<{
    encodedTx: Partial<IEncodedTx> | undefined;
  }> {
    return Promise.resolve({
      encodedTx,
    });
  }

  async buildFetchHistoryListParams(params: {
    accountId: string;
    networkId: string;
    accountAddress: string;
  }) {
    return Promise.resolve({});
  }

  async buildHistoryTx(params: {
    historyTxToMerge?: IAccountHistoryTx;
    decodedTx: IDecodedTx;
    signedTx?: ISignedTxPro;
    isSigner?: boolean;
    isLocalCreated?: boolean;
    accountAddress?: string;
    xpub?: string;
  }): Promise<IAccountHistoryTx> {
    const { historyTxToMerge, decodedTx, signedTx, isSigner, isLocalCreated } =
      params;

    let accountAddress = params.accountAddress || '';
    let xpub = params.xpub;

    const txid: string = signedTx?.txid || decodedTx?.txid || '';
    if (!txid) {
      throw new Error('buildHistoryTx txid not found');
    }

    const { accountId, networkId } = decodedTx;

    try {
      const [a, x] = await Promise.all([
        this.backgroundApi.serviceAccount.getAccountAddressForApi({
          accountId,
          networkId,
        }),
        this.backgroundApi.serviceAccount.getAccountXpub({
          accountId,
          networkId,
        }),
      ]);
      accountAddress = a;
      xpub = x;
    } catch (e) {
      // pass
    }

    decodedTx.txid = txid || decodedTx.txid;
    decodedTx.owner = accountAddress;
    decodedTx.xpub = xpub;
    if (isSigner) {
      decodedTx.signer = accountAddress;
    }

    // must include accountId here, so that two account wont share same tx history
    const historyId = accountUtils.buildLocalHistoryId({
      networkId,
      txid,
      accountAddress,
      xpub,
    });
    const historyTx: IAccountHistoryTx = {
      id: historyId,

      isLocalCreated: Boolean(isLocalCreated),

      ...historyTxToMerge,

      decodedTx,
    };
    return Promise.resolve(historyTx);
  }

  async buildOnChainHistoryTx(
    params: IBuildHistoryTxParams,
  ): Promise<IAccountHistoryTx | null> {
    const {
      accountId: originAccountId,
      networkId: originNetworkId,
      onChainHistoryTx,
      tokens,
      nfts,
      accountAddress: originAccountAddress,
      xpub,
      allNetworkHistoryExtraItems,
    } = params;
    let accountId = originAccountId;
    let networkId = originNetworkId;
    let accountAddress = originAccountAddress;

    if (originNetworkId === getNetworkIdsMap().onekeyall) {
      const allNetworkAccount = allNetworkHistoryExtraItems?.find(
        (i) => i.networkId === onChainHistoryTx.networkId,
      );
      if (allNetworkAccount) {
        accountId = allNetworkAccount.accountId;
        networkId = allNetworkAccount.networkId;
        accountAddress = allNetworkAccount.accountAddress;
      }
    }

    const vaultSettings =
      await this.backgroundApi.serviceNetwork.getVaultSettings({ networkId });
    try {
      const action = await this.buildHistoryTxAction({
        tx: onChainHistoryTx,
        tokens,
        nfts,
      });

      const decodedTx: IDecodedTx = {
        txid: onChainHistoryTx.tx,

        owner: accountAddress,
        signer: onChainHistoryTx.from,
        to: onChainHistoryTx.to,
        nonce: onChainHistoryTx.nonce,
        actions: [action],

        status: getOnChainHistoryTxStatus(onChainHistoryTx.status),

        networkId,
        accountId,
        xpub,

        totalFeeInNative: onChainHistoryTx.gasFee,

        totalFeeFiatValue: onChainHistoryTx.gasFeeFiatValue,

        nativeAmount: vaultSettings.isUtxo ? onChainHistoryTx.value : undefined,

        extraInfo: await this.buildOnChainHistoryTxExtraInfo({
          onChainHistoryTx,
        }),
        payload: {
          type: onChainHistoryTx.type,
          value: onChainHistoryTx.value,
          label: onChainHistoryTx.label,
        },
      };

      decodedTx.updatedAt = new Date(
        onChainHistoryTx.timestamp * 1000,
      ).getTime();
      decodedTx.createdAt = decodedTx.updatedAt;
      // On chain tx is always final
      decodedTx.isFinal = true;

      return await this.buildHistoryTx({
        decodedTx,
        accountAddress,
        xpub,
      });
    } catch (e) {
      console.log(e);
      return null;
    }
  }

  async buildHistoryTxAction({
    tx,
    tokens,
    nfts,
  }: {
    tx: IOnChainHistoryTx;
    tokens: Record<string, IOnChainHistoryTxToken>;
    nfts: Record<string, IOnChainHistoryTxNFT>;
  }) {
    if (tx.type === EOnChainHistoryTxType.Approve && tx.tokenApprove) {
      return this.buildHistoryTxApproveAction({
        tx,
        tokens,
        nfts,
        tokenApprove: tx.tokenApprove,
      });
    }

    if (isEmpty(tx.sends) && isEmpty(tx.receives)) {
      if (tx.type) return this.buildHistoryTxFunctionCallAction({ tx });
      return this.buildHistoryTxUnknownAction({ tx });
    }

    return this.buildHistoryTransferAction({ tx, tokens, nfts });
  }

  async buildHistoryTxFunctionCallAction({
    tx,
  }: {
    tx: IOnChainHistoryTx;
  }): Promise<IDecodedTxAction> {
    const network = await this.getNetwork();
    return {
      type: EDecodedTxActionType.FUNCTION_CALL,
      functionCall: {
        from: tx.from,
        to: tx.to,
        functionName: tx.label,
        functionHash: tx.functionCode,
        args: tx.params,
      },
    };
  }

  async buildHistoryTxUnknownAction({
    tx,
  }: {
    tx: IOnChainHistoryTx;
  }): Promise<IDecodedTxAction> {
    const network = await this.getNetwork();
    return {
      type: EDecodedTxActionType.UNKNOWN,
      unknownAction: {
        from: tx.from,
        to: tx.to,
        label: tx.label,
      },
    };
  }

  async buildHistoryTransferAction({
    tx,
    tokens,
    nfts,
  }: {
    tx: IOnChainHistoryTx;
    tokens: Record<string, IOnChainHistoryTxToken>;
    nfts: Record<string, IOnChainHistoryTxNFT>;
  }): Promise<IDecodedTxAction> {
    return {
      type: EDecodedTxActionType.ASSET_TRANSFER,
      assetTransfer: {
        from: tx.from,
        to: tx.to,
        label: tx.label,
        sends: tx.sends.map((send) =>
          this.buildHistoryTransfer({
            transfer: send,
            tokens,
            nfts,
          }),
        ),
        receives: tx.receives.map((receive) =>
          this.buildHistoryTransfer({
            transfer: receive,
            tokens,
            nfts,
          }),
        ),
      },
    };
  }

  buildHistoryTransfer({
    transfer,
    tokens,
    nfts,
  }: {
    transfer: IOnChainHistoryTxTransfer;
    tokens: Record<string, IOnChainHistoryTxToken>;
    nfts: Record<string, IOnChainHistoryTxNFT>;
  }) {
    const { icon, symbol, name, isNFT, isNative, price } =
      getOnChainHistoryTxAssetInfo({
        key: transfer.key,
        tokenAddress: transfer.token,
        tokens,
        nfts,
      });

    return {
      from: transfer.from,
      to: transfer.to,
      tokenIdOnNetwork: transfer.token,
      amount: transfer.amount,
      label: transfer.label,
      isOwn: transfer.isOwn,
      icon,
      name,
      symbol,
      isNFT,
      isNative,
      price,
    };
  }

  buildHistoryTxApproveAction({
    tx,
    tokens,
    nfts,
    tokenApprove,
  }: {
    tx: IOnChainHistoryTx;
    tokens: Record<string, IOnChainHistoryTxToken>;
    nfts: Record<string, IOnChainHistoryTxNFT>;
    tokenApprove: IOnChainHistoryTxApprove;
  }): IDecodedTxAction {
    const { icon, symbol, name, decimals } = getOnChainHistoryTxAssetInfo({
      key: tokenApprove.key,
      tokenAddress: tokenApprove.token,
      tokens,
      nfts,
    });
    return {
      type: EDecodedTxActionType.TOKEN_APPROVE,
      tokenApprove: {
        from: tx.from,
        to: tx.to,
        spender: tokenApprove.spender,
        icon,
        name,
        symbol,
        decimals,
        label: tx.label,
        tokenIdOnNetwork: tokenApprove.token,
        amount: new BigNumber(tokenApprove.amount)
          .shiftedBy(-decimals)
          .toFixed(),
        isInfiniteAmount: tokenApprove.isInfiniteAmount,
      },
    };
  }

  async buildTxTransferAssetAction(params: {
    from: string;
    to: string;
    transfers: IDecodedTxTransferInfo[];
    data?: string;
    application?: {
      name: string;
      icon: string;
    };
    internalStakingLabel?: string;
    isInternalSwap?: boolean;
    isInternalStaking?: boolean;
    swapReceivedAddress?: string;
    swapReceivedNetworkId?: string;
  }): Promise<IDecodedTxAction> {
    const {
      from,
      to,
      transfers,
      data,
      application,
      isInternalSwap,
      isInternalStaking,
      internalStakingLabel,
      swapReceivedAddress,
      swapReceivedNetworkId,
    } = params;
    const [accountAddress, network] = await Promise.all([
      this.getAccountAddress(),
      this.getNetwork(),
    ]);

    let sendNativeTokenAmountBN = new BigNumber(0);

    const assetTransfer: IDecodedTxActionAssetTransfer = {
      from,
      to,
      sends: [],
      receives: [],
      application,
      isInternalSwap,
      isInternalStaking,
      internalStakingLabel,
      swapReceivedAddress,
      swapReceivedNetworkId,
    };

    transfers.forEach((transfer) => {
      if (
        buildTxActionDirection({
          from: transfer.from,
          to: transfer.to,
          accountAddress,
        }) === EDecodedTxDirection.OUT
      ) {
        assetTransfer.sends.push(transfer);
        if (transfer.isNative) {
          sendNativeTokenAmountBN = sendNativeTokenAmountBN.plus(
            new BigNumber(transfer.amount),
          );
        }
      } else {
        assetTransfer.receives.push(transfer);
      }
    });

    assetTransfer.nativeAmount = sendNativeTokenAmountBN.toFixed();
    assetTransfer.nativeAmountValue = chainValueUtils.convertAmountToChainValue(
      {
        value: sendNativeTokenAmountBN,
        network,
      },
    );

    return {
      type: EDecodedTxActionType.ASSET_TRANSFER,
      data,
      assetTransfer,
    };
  }

  async buildInternalSwapAction(params: {
    swapInfo: ISwapTxInfo;
    swapData?: string;
    swapToAddress?: string;
  }) {
    const { swapData, swapInfo, swapToAddress } = params;
    const swapSendToken = swapInfo.sender.token;
    const swapReceiveToken = swapInfo.receiver.token;
    const providerInfo = swapInfo.swapBuildResData.result.info;
    const action = await this.buildTxTransferAssetAction({
      from: swapInfo.accountAddress,
      to: swapToAddress ?? '',
      data: swapData,
      application: {
        name: providerInfo.providerName,
        icon: providerInfo.providerLogo ?? '',
      },
      isInternalSwap: true,
      swapReceivedAddress: swapInfo.receivingAddress,
      swapReceivedNetworkId: swapInfo.receiver.token.networkId,
      transfers: [
        {
          from: swapInfo.accountAddress,
          to: '',
          tokenIdOnNetwork: swapSendToken.contractAddress,
          icon: swapSendToken.logoURI ?? '',
          name: swapSendToken.name ?? '',
          symbol: swapSendToken.symbol,
          amount: swapInfo.sender.amount,
          isNFT: false,
          isNative: swapSendToken.isNative,
        },
        {
          from: '',
          to: swapInfo.receivingAddress,
          tokenIdOnNetwork: swapReceiveToken.contractAddress,
          icon: swapReceiveToken.logoURI ?? '',
          name: swapReceiveToken.name ?? '',
          symbol: swapReceiveToken.symbol,
          amount: swapInfo.receiver.amount,
          isNFT: false,
          isNative: swapReceiveToken.isNative,
        },
      ],
    });
    return action;
  }

  async buildInternalStakingAction(params: {
    accountAddress: string;
    stakingToAddress?: string;
    stakingInfo: IStakingInfo;
    stakingData?: string;
  }) {
    const { stakingInfo, stakingData, accountAddress, stakingToAddress } =
      params;
    const { protocol, protocolLogoURI, send, receive } = stakingInfo;

    const transfers: IDecodedTxTransferInfo[] = [
      send && {
        from: accountAddress,
        to: '',
        tokenIdOnNetwork: send.token.address,
        icon: send.token.logoURI ?? '',
        name: send.token.name ?? '',
        symbol: send.token.symbol,
        amount: send.amount,
        isNFT: false,
        isNative: send.token.isNative,
      },
      receive && {
        from: '',
        to: accountAddress,
        tokenIdOnNetwork: receive.token.address,
        icon: receive.token.logoURI ?? '',
        name: receive.token.name ?? '',
        symbol: receive.token.symbol,
        amount: receive.amount,
        isNFT: false,
        isNative: receive.token.isNative,
      },
    ].filter(Boolean);

    const action = await this.buildTxTransferAssetAction({
      from: accountAddress,
      to: stakingToAddress ?? '',
      data: stakingData,
      application: {
        name: protocol,
        icon: protocolLogoURI ?? '',
      },
      isInternalStaking: true,
      internalStakingLabel: getStakingActionLabel({ stakingInfo }),
      transfers,
    });
    return action;
  }

  // DO NOT override this method
  async signTransaction(params: ISignTransactionParams): Promise<ISignedTxPro> {
    const { unsignedTx } = params;
    params.signOnly = params.signOnly ?? true;
    const signedTx = await this.keyring.signTransaction(params);
    return {
      ...signedTx,
      encodedTx: signedTx.encodedTx ?? unsignedTx.encodedTx,
    };
  }

  // TODO resetCache after dbAccount and network DB updated
  // TODO add memo
  async getAccount({
    dbAccount,
  }: {
    dbAccount?: IDBAccount;
  } = {}): Promise<INetworkAccount> {
    let account: IDBAccount | undefined = dbAccount;
    if (!account || account?.id !== this.accountId) {
      account = await this.backgroundApi.serviceAccount.getDBAccount({
        accountId: this.accountId,
      });
    }

    if (
      !accountUtils.isAccountCompatibleWithNetwork({
        account,
        networkId: this.networkId,
      })
    ) {
      throw new Error(
        `account impl not matched to network: ${
          this.networkId
        } ${account.id?.slice(0, 30)}`,
      );
    }

    const networkInfo = await this.getNetworkInfo();

    const externalAccount = account as IDBExternalAccount;
    let externalAccountAddress = '';
    if (externalAccount.connectedAddresses) {
      const buildExternalAccountAddress = ({
        key,
        fallbackIndex,
      }: {
        key: string;
        fallbackIndex: number;
      }) => {
        if (!key) {
          return '';
        }
        const index = externalAccount.selectedAddress?.[key] ?? fallbackIndex;
        const addresses =
          externalAccount.connectedAddresses?.[key]
            ?.split(',')
            .filter(Boolean) || [];
        return addresses?.[index] || addresses?.[fallbackIndex] || '';
      };

      externalAccountAddress = buildExternalAccountAddress({
        key: this.networkId,
        fallbackIndex: -1,
      });

      if (!externalAccountAddress) {
        const impl = await this.getNetworkImpl();

        externalAccountAddress = buildExternalAccountAddress({
          key: impl,
          fallbackIndex: 0,
        });
      }
      if (!externalAccountAddress) {
        externalAccountAddress = buildExternalAccountAddress({
          key: this.networkId,
          fallbackIndex: 0,
        });
      }
    }

    const addressDetail = await this.buildAccountAddressDetail({
      networkInfo,
      account,
      networkId: this.networkId,
      externalAccountAddress,
    });

    // always use addressDetail.address as account.address, which is normalized and validated
    const address = addressDetail?.address || '';

    if (
      (!address && !addressDetail.allowEmptyAddress) ||
      !addressDetail.isValid
    ) {
      throw new Error('VaultBase.getAccount ERROR: address is invalid');
    }

    return {
      ...account,
      addressDetail,
      address,
    };
  }

  async getAccountAddress() {
    return (await this.getAccount()).address;
  }

  async getAccountPath() {
    return (await this.getAccount()).path;
  }

  async getAccountXpub({
    dbAccount,
  }: {
    dbAccount?: IDBAccount;
  } = {}): Promise<string | undefined> {
    const networkAccount = await this.getAccount({ dbAccount });
    return this.getXpubFromAccount(networkAccount);
  }

  async fillTokensDetails({
    tokensDetails,
  }: {
    tokensDetails: IFetchTokenDetailItem[];
  }) {
    return Promise.resolve(tokensDetails);
  }

  async fillAccountDetails({
    accountDetails,
  }: {
    accountDetails: IFetchAccountDetailsResp;
  }) {
    return Promise.resolve(accountDetails);
  }

  async isEarliestLocalPendingTx({
    encodedTx,
  }: {
    encodedTx: IEncodedTx;
  }): Promise<boolean> {
    return true;
  }

  async buildReplaceEncodedTx({
    decodedTx,
    replaceType,
  }: {
    decodedTx: IDecodedTx;
    replaceType: EReplaceTxType;
  }) {
    return Promise.resolve(decodedTx.encodedTx);
  }

  async attachFeeInfoToDAppEncodedTx(params: {
    encodedTx: IEncodedTx;
    feeInfo: IFeeInfoUnit;
  }): Promise<IEncodedTx> {
    return Promise.resolve(params.encodedTx);
  }

  async activateToken(params: { token: IAccountToken }): Promise<boolean> {
    throw new NotImplemented();
  }

  async getAddressType({ address }: { address: string }): Promise<{
    typeKey?: MessageDescriptor['id'];
    type?: string;
  }> {
    return Promise.resolve({});
  }

  // Staking
  buildStakeEncodedTx(params: IStakeTx): Promise<IEncodedTx> {
    return Promise.resolve(params as IEncodedTx);
  }

  // Api Request
  async fetchAccountDetails(
    params: IFetchServerAccountDetailsParams,
  ): Promise<IFetchServerAccountDetailsResponse> {
    const isCustomNetwork =
      await this.backgroundApi.serviceNetwork.isCustomNetwork({
        networkId: this.networkId,
      });
    if (isCustomNetwork) {
      return this.fetchAccountDetailsByRpc(params);
    }
    return this.fetchAccountDetailsByApi(params);
  }

  async fetchAccountDetailsByApi(
    params: IFetchServerAccountDetailsParams,
  ): Promise<IFetchServerAccountDetailsResponse> {
    const queryParams = {
      ...omit(params, ['accountId', 'signal']),
    };

    const client = await this.backgroundApi.serviceAccountProfile.getClient(
      EServiceEndpointEnum.Wallet,
    );
    const resp = await client.get<{
      data: IFetchAccountDetailsResp;
    }>(
      `/wallet/v1/account/get-account?${qs.stringify(
        omitBy(queryParams, isNil),
      )}`,
      {
        headers:
          await this.backgroundApi.serviceAccountProfile._getWalletTypeHeader({
            accountId: params.accountId,
          }),
        signal: params.signal,
      },
    );

    return resp;
  }

  async fetchAccountDetailsByRpc(
    params: IFetchServerAccountDetailsParams,
  ): Promise<IFetchServerAccountDetailsResponse> {
    throw new NotImplemented();
  }

  async fetchTokenList(
    params: IFetchServerTokenListParams,
  ): Promise<IFetchServerTokenListResponse> {
    const isCustomNetwork =
      await this.backgroundApi.serviceNetwork.isCustomNetwork({
        networkId: this.networkId,
      });
    if (isCustomNetwork) {
      return this.fetchTokenListByRpc(params);
    }
    return this.fetchTokenListByApi(params);
  }

  async fetchTokenListByApi(
    params: IFetchServerTokenListParams,
  ): Promise<IFetchServerTokenListResponse> {
    const { serviceToken, serviceAccountProfile } = this.backgroundApi;
    const { requestApiParams, flag, signal, accountId } = params;
    if (requestApiParams.contractList) {
      requestApiParams.contractList = requestApiParams.contractList.filter(
        (contract): contract is string =>
          contract !== null && typeof contract === 'string',
      );
    }
    const client = await serviceToken.getClient(EServiceEndpointEnum.Wallet);
    const resp = await client.post<{
      data: IFetchAccountTokensResp;
    }>(`/wallet/v1/account/token/list?flag=${flag || ''}`, requestApiParams, {
      signal,
      headers: await serviceAccountProfile._getWalletTypeHeader({
        accountId,
      }),
    });
    return resp;
  }

  async fetchTokenListByRpc(
    params: IFetchServerTokenListParams,
  ): Promise<IFetchServerTokenListResponse> {
    throw new NotImplemented();
  }

  async estimateFee(
    params: IEstimateGasParams,
  ): Promise<IServerEstimateFeeResponse> {
    const isCustomNetwork =
      await this.backgroundApi.serviceNetwork.isCustomNetwork({
        networkId: this.networkId,
      });
    if (isCustomNetwork) {
      return this.estimateFeeByRpc(params);
    }
    return this.estimateFeeByApi(params);
  }

  async estimateFeeByApi(
    params: IEstimateGasParams,
  ): Promise<IServerEstimateFeeResponse> {
    const { accountId, ...rest } = params;
    const client = await this.backgroundApi.serviceGas.getClient(
      EServiceEndpointEnum.Wallet,
    );
    const resp = await client.post<{ data: IEstimateGasResp }>(
      '/wallet/v1/account/estimate-fee',
      rest,
      {
        headers:
          await this.backgroundApi.serviceAccountProfile._getWalletTypeHeader({
            accountId,
          }),
      },
    );
    return resp;
  }

  async estimateFeeByRpc(
    params: IEstimateGasParams,
  ): Promise<IServerEstimateFeeResponse> {
    throw new NotImplemented();
  }

  async fetchAccountHistoryDetail(
    params: IServerFetchAccountHistoryDetailParams,
  ): Promise<IServerFetchAccountHistoryDetailResp> {
    const isCustomNetwork =
      await this.backgroundApi.serviceNetwork.isCustomNetwork({
        networkId: this.networkId,
      });
    if (isCustomNetwork) {
      return this.fetchAccountHistoryDetailByRpc(params);
    }
    return this.fetchAccountHistoryDetailByApi(params);
  }

  async fetchAccountHistoryDetailByApi(
    params: IServerFetchAccountHistoryDetailParams,
  ): Promise<IServerFetchAccountHistoryDetailResp> {
    const { accountId, ...rest } = params;
    const client = await this.backgroundApi.serviceGas.getClient(
      EServiceEndpointEnum.Wallet,
    );
    const resp = await client.get<{ data: IFetchHistoryTxDetailsResp }>(
      '/wallet/v1/account/history/detail',
      {
        params: rest,
        headers:
          await this.backgroundApi.serviceAccountProfile._getWalletTypeHeader({
            accountId,
          }),
      },
    );
    return resp;
  }

  async fetchAccountHistoryDetailByRpc(
    params: IServerFetchAccountHistoryDetailParams,
  ): Promise<IServerFetchAccountHistoryDetailResp> {
    throw new NotImplemented();
  }

  async buildOkxSwapEncodedTx(
    params: IBuildOkxSwapEncodedTxParams,
  ): Promise<IEncodedTx> {
    throw new NotImplemented();
  }
}
