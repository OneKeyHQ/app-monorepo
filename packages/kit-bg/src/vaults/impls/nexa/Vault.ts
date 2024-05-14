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
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
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

    const preEncodedTx: IEncodedTxNexa = {
      inputs: utxos,
      outputs: [
        {
          address: to,
          satoshis: new BigNumber(amount).shiftedBy(network.decimals).toFixed(),
          outType: 1,
        },
      ],
      allUtxos: utxos,
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
      allUtxos: utxos,
    };
  }

  override async buildDecodedTx(
    params: IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const { unsignedTx } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxNexa;
    const { finalInputs: inputs, outputs } = encodedTx;
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

    const utxoFrom = (inputs ?? []).map((input) => ({
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
    const account = await this.getAccount();
    if (encodedTx) {
      return {
        encodedTx,
        txSize: checkIsDefined(encodedTx.estimateTxSize),
        payload: {
          address: account.address,
        },
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
    const network = await this.getNetwork();
    console.log('====>params: ', params);
    const newFee = new BigNumber(feeInfo?.feeUTXO?.feeRate || '0.03')
      .times(txSize ?? 0)
      .shiftedBy(network.decimals)
      .decimalPlaces(
        feeInfo?.common.feeDecimals ?? network.feeMeta.decimals,
        BigNumber.ROUND_CEIL,
      )
      .toFixed(0);
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
        const { utxoList: utxos } =
          await this.backgroundApi.serviceAccountProfile.fetchAccountDetails({
            networkId: this.networkId,
            accountAddress: address,
            withUTXOList: true,
          });
        if (!utxos || isEmpty(utxos)) {
          throw new OneKeyInternalError('Failed to get UTXO list.');
        }

        return utxos.map((utxo) => ({
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
    const amountBig = new BigNumber(amount);
    const feeBig = new BigNumber(fee);
    const requiredAmount = amountBig.plus(feeBig);

    const confirmedUTXOs = utxos.sort((a, b) =>
      new BigNumber(b.satoshis).gt(a.satoshis) ? 1 : -1,
    );

    // Calculate the total satoshis available from all UTXOs
    let totalUtxosSum = new BigNumber(0);
    utxos.forEach((utxo) => {
      totalUtxosSum = totalUtxosSum.plus(utxo.satoshis);
    });

    // Check if it's a max value transfer
    if (totalUtxosSum.eq(amountBig) || totalUtxosSum.eq(requiredAmount)) {
      // If the total UTXOs sum matches exactly the amount or amount + fee
      // it's a maximum value transfer, return all UTXOs
      return utxos;
    }

    let sum = new BigNumber(0);
    const selectedUTXOs = [];
    for (const utxo of confirmedUTXOs) {
      sum = sum.plus(utxo.satoshis);
      selectedUTXOs.push(utxo);
      if (sum.gte(requiredAmount)) {
        if (sum.eq(requiredAmount)) {
          // If the total exactly matches the required amount, no change is needed
          return selectedUTXOs;
        }
        if (sum.lt(requiredAmount.plus(minTransferAmount))) {
          // If the current total is less than the required amount plus the minimum transfer amount,
          // continue selecting UTXOs to avoid creating dust change
          // eslint-disable-next-line no-continue
          continue; // Assuming the logic here is to keep looping to select more UTXOs
        } else {
          // Otherwise, the total is sufficient and the change is also adequate, safely return
          return selectedUTXOs;
        }
      }
    }

    // Return all UTXOs if sum is enough including minTransferAmount, otherwise empty array
    return sum.gte(requiredAmount.plus(minTransferAmount)) ? selectedUTXOs : [];
  }

  async _estimateTxSize(encodedTx: IEncodedTxNexa, fee: string) {
    const { allUtxos, outputs } = encodedTx;
    const settings = await this.getVaultSettings();
    const network = await this.getNetwork();
    const minTransferAmount = new BigNumber(settings.minTransferAmount ?? '0')
      .shiftedBy(network.decimals)
      .toFixed();
    const finalInputs = this._coinSelect(
      allUtxos ?? [],
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
