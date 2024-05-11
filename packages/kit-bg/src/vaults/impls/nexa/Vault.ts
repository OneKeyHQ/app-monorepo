/* eslint-disable @typescript-eslint/no-unused-vars */
import BigNumber from 'bignumber.js';
import { isEmpty } from 'lodash';

import {
  estimateFee,
  estimateSize,
  getDisplayAddress,
  verifyNexaAddress,
} from '@onekeyhq/core/src/chains/nexa/sdkNexa';
import type {
  IEncodedTxNexa,
  INexaUTXO,
} from '@onekeyhq/core/src/chains/nexa/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  IEncodedTx,
  ISignedTxPro,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
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
import { EOnChainHistoryTxType } from '@onekeyhq/shared/types/history';
import {
  EDecodedTxActionType,
  EDecodedTxStatus,
  type IDecodedTx,
  type IDecodedTxAction,
} from '@onekeyhq/shared/types/tx';

import { VaultBase } from '../../base/VaultBase';

import { KeyringExternal } from './KeyringExternal';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';

import type { IDBWalletType } from '../../../dbs/local/types';
import type { KeyringBase } from '../../base/KeyringBase';
import type {
  IBroadcastTransactionParams,
  IBuildAccountAddressDetailParams,
  IBuildDecodedTxParams,
  IBuildEncodedTxParams,
  IBuildUnsignedTxParams,
  IGetPrivateKeyFromImportedParams,
  IGetPrivateKeyFromImportedResult,
  IUpdateUnsignedTxParams,
  IUtxoInfo,
  IValidateGeneralInputParams,
  IVaultSettings,
} from '../../types';

export default class Vault extends VaultBase {
  override coreApi = coreChainApi.nexa.hd;

  override keyringMap: Record<IDBWalletType, typeof KeyringBase> = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringExternal,
  };

  override async buildAccountAddressDetail(
    params: IBuildAccountAddressDetailParams,
  ): Promise<INetworkAccountAddressDetail> {
    const { account, networkId } = params;
    const network = await this.getNetwork();
    const displayAddress = getDisplayAddress({
      address: account.address,
      chainId: network.chainId,
    });
    return {
      networkId,
      normalizedAddress: displayAddress,
      displayAddress,
      address: displayAddress,
      baseAddress: account.address,
      isValid: true,
      allowEmptyAddress: false,
    };
  }

  override async buildEncodedTx(
    params: IBuildEncodedTxParams,
  ): Promise<IEncodedTxNexa> {
    const { transfersInfo } = params;
    if (!transfersInfo || isEmpty(transfersInfo)) {
      throw new OneKeyInternalError('transfersInfo is required');
    }
    if (transfersInfo.length > 1) {
      throw new OneKeyInternalError('Batch transfer is not supported');
    }
    const transferInfo = transfersInfo[0];
    if (!transferInfo.to) {
      throw new Error('buildEncodedTx ERROR: transferInfo.to is missing');
    }
    const { to, amount } = transferInfo;
    const dbAccount = await this.getAccount();
    const network = await this.getNetwork();
    const utxos = await this._collectUTXOsInfoByApi({
      address: dbAccount.address,
    });

    const preEncodedTx = {
      inputs: utxos,
      outputs: [
        {
          address: to,
          satoshis: new BigNumber(amount).shiftedBy(network.decimals).toFixed(),
          outType: 1,
        },
      ],
    };

    const { finalInputs, estimateTxSize } = await this._estimateTxSize(
      preEncodedTx,
      '0',
    );

    return {
      ...preEncodedTx,
      gas: '0',
      totalFeeInNative: '0',
      finalInputs,
      estimateTxSize,
    };
  }

  override async buildDecodedTx(
    params: IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const { unsignedTx } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxNexa;
    const { inputs, outputs } = encodedTx;
    const network = await this.getNetwork();
    const account = await this.getAccount();
    const nativeToken = await this.backgroundApi.serviceToken.getToken({
      networkId: this.networkId,
      tokenIdOnNetwork: '',
      accountAddress: account.address,
    });

    if (!nativeToken) {
      throw new OneKeyInternalError('Native token not found');
    }

    let actions: IDecodedTxAction[] = [];

    const utxoFrom = inputs.map((input) => ({
      address: input.address,
      balance: new BigNumber(input.satoshis)
        .shiftedBy(-network.decimals)
        .toFixed(),
      balanceValue: input.satoshis,
      symbol: network.symbol,
      isMine: true,
    }));
    const utxoTo = outputs.map((output) => ({
      address: output.address,
      balance: new BigNumber(output.satoshis)
        .shiftedBy(-network.decimals)
        .toFixed(),
      balanceValue: output.satoshis,
      symbol: network.symbol,
      isMine: output.address === account.address,
    }));

    let sendNativeTokenAmountBN = new BigNumber(0);
    let sendNativeTokenAmountValueBN = new BigNumber(0);

    actions = [
      {
        type: EDecodedTxActionType.ASSET_TRANSFER,
        assetTransfer: {
          from: account.address,
          to: utxoTo[0].address,
          sends: utxoTo.map((utxo) => {
            sendNativeTokenAmountBN = sendNativeTokenAmountBN.plus(
              utxo.balance,
            );
            sendNativeTokenAmountValueBN = sendNativeTokenAmountValueBN.plus(
              utxo.balanceValue,
            );
            return {
              from: account.address,
              to: utxo.address,
              isNative: true,
              tokenIdOnNetwork: '',
              name: nativeToken.name,
              icon: nativeToken.logoURI ?? '',
              amount: utxo.balance,
              amountValue: utxo.balanceValue,
              symbol: network.symbol,
            };
          }),
          receives: [],
          utxoFrom,
          utxoTo,
        },
      },
    ];

    return {
      txid: '',
      owner: account.address,
      signer: account.address,
      nonce: 0,
      actions,
      status: EDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      extraInfo: null,
      payload: {
        type: EOnChainHistoryTxType.Send,
      },
      encodedTx,
      // totalFeeInNative,
      nativeAmount: sendNativeTokenAmountBN.toFixed(),
      nativeAmountValue: sendNativeTokenAmountValueBN.toFixed(),
    };
  }

  override async buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const encodedTx = await this.buildEncodedTx(params);
    if (encodedTx) {
      return {
        encodedTx,
        // FIXME: txSize is not correct
        txSize: 1,
      };
    }
    throw new OneKeyInternalError('Failed to build unsigned tx');
  }

  override async updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const {
      unsignedTx: { txSize, encodedTx },
      feeInfo,
    } = params;
    console.log('====>params: ', params);
    const newFee = new BigNumber(feeInfo?.feeUTXO?.feeRate || '0.03')
      .times(txSize ?? 0)
      .toString();
    const { finalInputs } = await this._estimateTxSize(
      params.unsignedTx.encodedTx as IEncodedTxNexa,
      newFee,
    );
    const fixedEncodedTx = {
      ...(encodedTx as IEncodedTxNexa),
      inputs: finalInputs,
      gas: newFee,
      finalInputs,
    };
    return {
      ...params.unsignedTx,
      encodedTx: fixedEncodedTx,
    };
  }

  override broadcastTransaction(
    params: IBroadcastTransactionParams,
  ): Promise<ISignedTxPro> {
    throw new Error('Method not implemented.');
  }

  override validateAddress(address: string): Promise<IAddressValidation> {
    const { isValid, normalizedAddress } = verifyNexaAddress(address);
    const formattedAddress = isValid ? normalizedAddress || address : '';
    return Promise.resolve({
      isValid,
      normalizedAddress: formattedAddress,
      displayAddress: formattedAddress,
    });
  }

  override validateXpub(xpub: string): Promise<IXpubValidation> {
    return Promise.resolve({
      isValid: false,
    });
  }

  override getPrivateKeyFromImported(
    params: IGetPrivateKeyFromImportedParams,
  ): Promise<IGetPrivateKeyFromImportedResult> {
    return super.baseGetPrivateKeyFromImported(params);
  }

  override validateXprvt(xprvt: string): Promise<IXprvtValidation> {
    return Promise.resolve({
      isValid: false,
    });
  }

  override validatePrivateKey(
    privateKey: string,
  ): Promise<IPrivateKeyValidation> {
    return this.baseValidatePrivateKey(privateKey);
  }

  override async validateGeneralInput(
    params: IValidateGeneralInputParams,
  ): Promise<IGeneralInputValidation> {
    const { result } = await this.baseValidateGeneralInput(params);
    return result;
  }

  _collectUTXOsInfoByApi = memoizee(
    async (params: { address: string }): Promise<INexaUTXO[]> => {
      const { address } = params;
      try {
        // @ts-expect-error
        const { utxoList: utxos } =
          await this.backgroundApi.serviceAccountProfile.fetchAccountDetails({
            networkId: this.networkId,
            accountAddress: address,
            withUTXOList: true,
          });
        if (!utxos || isEmpty(utxos)) {
          throw new OneKeyInternalError('Failed to get UTXO list.');
        }

        return (utxos as IUtxoInfo[]).map((utxo) => ({
          txId: utxo.txid,
          outputIndex: utxo.vout,
          satoshis: utxo.value,
          address,
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

  _coinSelect(
    utxos: INexaUTXO[],
    amount: string,
    fee: string,
    minTransferAmount = '0',
  ): INexaUTXO[] {
    const totalAmount = new BigNumber(amount).plus(fee).plus(minTransferAmount);
    const confirmedUTXOs = utxos.sort((a, b) =>
      new BigNumber(b.satoshis).gt(a.satoshis) ? 1 : -1,
    );
    let sum = new BigNumber(0);
    let i = 0;
    for (i = 0; i < confirmedUTXOs.length; i += 1) {
      sum = sum.plus(confirmedUTXOs[i].satoshis);
      if (sum.gt(totalAmount)) {
        break;
      }
    }

    // all amount
    if (sum.eq(amount) && i === confirmedUTXOs.length) {
      return utxos;
    }
    if (sum.lt(totalAmount)) {
      return [];
    }

    return confirmedUTXOs.slice(0, i + 1);
  }

  async _estimateTxSize(encodedTx: IEncodedTxNexa, fee: string) {
    const { inputs, outputs } = encodedTx;
    const settings = await this.getVaultSettings();
    const network = await this.getNetwork();
    const minTransferAmount = new BigNumber(settings.minTransferAmount ?? '0')
      .shiftedBy(network.decimals)
      .toFixed();
    const finalInputs = this._coinSelect(
      inputs,
      new BigNumber(outputs[0].satoshis || 0).toFixed(),
      fee,
      minTransferAmount,
    );
    const estimateTxSize = estimateFee(
      {
        ...encodedTx,
        inputs: finalInputs,
      },
      1,
    );
    return { finalInputs, estimateTxSize };
  }
}
