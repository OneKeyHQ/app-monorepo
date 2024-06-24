/* eslint-disable @typescript-eslint/no-unused-vars */
import BigNumber from 'bignumber.js';
import { isEmpty } from 'lodash';

import type {
  IEncodedTxDnx,
  IUnspentOutput,
} from '@onekeyhq/core/src/chains/dnx/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { coinSelect } from '@onekeyhq/core/src/utils/coinSelectUtils';
import {
  InsufficientBalance,
  NotImplemented,
  OneKeyInternalError,
} from '@onekeyhq/shared/src/errors';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IAddressValidation,
  IGeneralInputValidation,
  INetworkAccountAddressDetail,
  IPrivateKeyValidation,
  IXprvtValidation,
  IXpubValidation,
} from '@onekeyhq/shared/types/address';
import type { IOnChainHistoryTx } from '@onekeyhq/shared/types/history';
import type { IFetchTokenDetailItem } from '@onekeyhq/shared/types/token';
import {
  EDecodedTxActionType,
  EDecodedTxDirection,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';
import type {
  IDecodedTx,
  IDecodedTxExtraInfo,
  IDecodedTxTransferInfo,
} from '@onekeyhq/shared/types/tx';

import { VaultBase } from '../../base/VaultBase';

import { KeyringExternal } from './KeyringExternal';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';

import type { IDBUtxoAccount, IDBWalletType } from '../../../dbs/local/types';
import type { KeyringBase } from '../../base/KeyringBase';
import type {
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

const DEFAULT_TX_FEE = 1000000;

export default class Vault extends VaultBase {
  override coreApi = coreChainApi.dynex.hd;

  override keyringMap: Record<IDBWalletType, typeof KeyringBase | undefined> = {
    hd: KeyringHd,
    qr: undefined,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringExternal,
  };

  override async buildAccountAddressDetail(
    params: IBuildAccountAddressDetailParams,
  ): Promise<INetworkAccountAddressDetail> {
    const { account, networkId } = params;
    const { address } = account;
    return {
      networkId,
      normalizedAddress: address,
      displayAddress: address,
      address,
      baseAddress: address,
      isValid: true,
      allowEmptyAddress: false,
    };
  }

  override buildEncodedTx(
    params: IBuildEncodedTxParams,
  ): Promise<IEncodedTxDnx> {
    const { transfersInfo } = params;

    if (transfersInfo && !isEmpty(transfersInfo)) {
      if (transfersInfo.length === 1) {
        return this._buildEncodedTxFromTransfer({
          transferInfo: transfersInfo[0],
        });
      }
      throw new OneKeyInternalError('Batch transfers not supported');
    }

    throw new OneKeyInternalError();
  }

  async _buildEncodedTxFromTransfer(params: { transferInfo: ITransferInfo }) {
    const { transferInfo } = params;
    const { tokenInfo } = transferInfo;

    if (!transferInfo.to) {
      throw new Error('buildEncodedTx ERROR: transferInfo.to is missing');
    }

    if (!tokenInfo) {
      throw new Error(
        'buildEncodedTx ERROR: transferInfo.tokenInfo is missing',
      );
    }

    const network = await this.getNetwork();

    const unspentOutputs = await this._collectUnspentOutputs();
    const { inputs, finalAmount } = this._collectInputs({
      unspentOutputs,
      amount: new BigNumber(transferInfo.amount)
        .shiftedBy(network.decimals)
        .toFixed(),
      fee: new BigNumber(DEFAULT_TX_FEE).toFixed(),
    });

    return {
      from: transferInfo.from,
      to: transferInfo.to,
      amount: new BigNumber(finalAmount).shiftedBy(-network.decimals).toFixed(),
      paymentId: transferInfo.paymentId,
      fee: new BigNumber(DEFAULT_TX_FEE)
        .shiftedBy(-network.feeMeta.decimals)
        .toFixed(),
      inputs,
    };
  }

  _collectUnspentOutputs = memoizee(
    async () => {
      try {
        const { utxoList } =
          await this.backgroundApi.serviceAccountProfile.fetchAccountDetails({
            networkId: this.networkId,
            accountAddress: await this.getAccountAddress(),
            withUTXOList: true,
            withFrozenBalance: true,
          });
        if (!utxoList) {
          throw new OneKeyInternalError('Failed to get UTXO list.');
        }
        return utxoList.map((utxo) => ({
          prevIndex: utxo.vout,
          globalIndex: utxo.globalIndex,
          txPubkey: utxo.txPubkey,
          prevOutPubkey: utxo.prevOutPubkey,
          amount: Number(utxo.value),
        }));
      } catch (e) {
        throw new OneKeyInternalError('Failed to get UTXO list.');
      }
    },
    {
      promise: true,
      max: 1,
      maxAge: timerUtils.getTimeDurationMs({ seconds: 30 }),
    },
  );

  _collectInputs({
    unspentOutputs,
    amount,
    fee,
  }: {
    amount: string;
    fee: string;
    unspentOutputs: IUnspentOutput[];
  }) {
    let finalAmount = new BigNumber(amount);
    const totalUnspentOutputsAmount = unspentOutputs.reduce(
      (acc, output) => acc.plus(output.amount),
      new BigNumber(0),
    );

    if (totalUnspentOutputsAmount.lte(fee)) {
      throw new InsufficientBalance();
    }

    if (totalUnspentOutputsAmount.lt(new BigNumber(finalAmount).plus(fee))) {
      finalAmount = totalUnspentOutputsAmount.minus(fee);
    }

    const inputsForCoinSelect = unspentOutputs.map((output) => ({
      txId: '',
      vout: 0,
      value: output.amount,
      address: '',
      path: '',
      ...output,
    }));

    const outputsForCoinSelect = [
      {
        address: '',
        value: finalAmount.plus(fee).toNumber(),
      },
    ];

    const { inputs: inputsFromCoinSelect } = coinSelect({
      inputsForCoinSelect,
      outputsForCoinSelect,
      feeRate: '0',
    });

    return {
      finalAmount: finalAmount.toFixed(),
      inputs:
        inputsFromCoinSelect?.map((input) => {
          const tempInput = input as unknown as IUnspentOutput;
          return {
            globalIndex: tempInput.globalIndex,
            prevIndex: tempInput.prevIndex,
            prevOutPubkey: tempInput.prevOutPubkey,
            txPubkey: tempInput.txPubkey,
            amount: tempInput.amount,
          };
        }) ?? [],
    };
  }

  override async buildDecodedTx(
    params: IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const { unsignedTx } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxDnx;
    const account = await this.getAccount();
    const nativeToken = await this.backgroundApi.serviceToken.getNativeToken({
      networkId: this.networkId,
      accountId: this.accountId,
    });

    const transfer: IDecodedTxTransferInfo = {
      from: encodedTx.from,
      to: encodedTx.to,
      tokenIdOnNetwork: nativeToken.address,
      icon: nativeToken.logoURI ?? '',
      name: nativeToken.name,
      symbol: nativeToken.symbol,
      amount: encodedTx.amount,
      isNFT: false,
      isNative: true,
    };

    const action = await this.buildTxTransferAssetAction({
      from: transfer.from,
      to: transfer.to,
      transfers: [transfer],
    });

    const decodedTx: IDecodedTx = {
      txid: '',
      owner: account.address,
      signer: encodedTx.from || account.address,
      nonce: 0,
      to: encodedTx.to,
      actions: [action],
      status: EDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      xpub: (account as IDBUtxoAccount).xpub,
      encodedTx,
      extraInfo: {
        paymentId: encodedTx.paymentId,
      },
    };

    return decodedTx;
  }

  override async buildOnChainHistoryTxExtraInfo({
    onChainHistoryTx,
  }: {
    onChainHistoryTx: IOnChainHistoryTx;
  }): Promise<IDecodedTxExtraInfo | null> {
    return {
      paymentId: onChainHistoryTx.paymentId,
    };
  }

  override async buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const encodedTx = params.encodedTx ?? (await this.buildEncodedTx(params));
    if (encodedTx) {
      return this._buildUnsignedTxFromEncodedTx(encodedTx as IEncodedTxDnx);
    }
    throw new OneKeyInternalError();
  }

  async _buildUnsignedTxFromEncodedTx(encodedTx: IEncodedTxDnx) {
    return { encodedTx };
  }

  override updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    return Promise.resolve(params.unsignedTx);
  }

  override validateAddress(address: string): Promise<IAddressValidation> {
    return this._validateAddressCache(address);
  }

  _validateAddressCache = memoizee(
    async (address: string) => {
      try {
        const res =
          await this.backgroundApi.serviceAccountProfile.validateAddress({
            networkId: this.networkId,
            address,
          });

        if (res === 'valid') {
          return {
            normalizedAddress: address,
            displayAddress: address,
            isValid: true,
          };
        }
      } catch (e) {
        console.log(e);
      }

      return {
        normalizedAddress: '',
        displayAddress: '',
        isValid: false,
      };
    },
    {
      primitive: true,
      maxAge: timerUtils.getTimeDurationMs({ minute: 3 }),
      max: 10,
    },
  );

  override validateXpub(xpub: string): Promise<IXpubValidation> {
    throw new NotImplemented();
  }

  override getPrivateKeyFromImported(
    params: IGetPrivateKeyFromImportedParams,
  ): Promise<IGetPrivateKeyFromImportedResult> {
    throw new NotImplemented();
  }

  override validateXprvt(xprvt: string): Promise<IXprvtValidation> {
    throw new NotImplemented();
  }

  override validatePrivateKey(
    privateKey: string,
  ): Promise<IPrivateKeyValidation> {
    throw new NotImplemented();
  }

  override validateGeneralInput(
    params: IValidateGeneralInputParams,
  ): Promise<IGeneralInputValidation> {
    throw new NotImplemented();
  }

  override async fillTokensDetails({
    tokensDetails,
  }: {
    tokensDetails: IFetchTokenDetailItem[];
  }): Promise<IFetchTokenDetailItem[]> {
    const filledTokensDetails: IFetchTokenDetailItem[] = [];
    for (const token of tokensDetails) {
      if (token.info.isNative && (await this._checkHasLocalTxOutInPending())) {
        filledTokensDetails.push({
          ...token,
          frozenBalance: token.balance,
          frozenBalanceParsed: token.balanceParsed,
        });
      } else {
        filledTokensDetails.push(token);
      }
    }

    return filledTokensDetails;
  }

  async _checkHasLocalTxOutInPending() {
    let hasLocalTxOutInPending = false;
    const accountAddress = await this.getAccountAddress();
    await this.backgroundApi.serviceHistory.fetchAccountHistory({
      networkId: this.networkId,
      accountId: this.accountId,
    });

    const pendingTxs =
      await this.backgroundApi.serviceHistory.getAccountLocalHistoryPendingTxs({
        networkId: this.networkId,
        accountAddress,
      });

    for (let i = 0, len = pendingTxs.length; i < len; i = +1) {
      const item = pendingTxs[i];
      const action = item.decodedTx.actions[0];
      if (
        (action.type === EDecodedTxActionType.ASSET_TRANSFER &&
          action.assetTransfer?.sends[0].isNative &&
          EDecodedTxDirection.OUT === action.direction) ||
        EDecodedTxDirection.SELF === action.direction
      ) {
        hasLocalTxOutInPending = true;
        break;
      }
    }

    return hasLocalTxOutInPending;
  }
}
