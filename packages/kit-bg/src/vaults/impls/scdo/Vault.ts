/* eslint-disable @typescript-eslint/no-unused-vars */
import BigNumber from 'bignumber.js';

import type { IEncodedTxScdo } from '@onekeyhq/core/src/chains/scdo/types';
import type { IEncodedTx, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { NotImplemented } from '@onekeyhq/shared/src/errors';
import chainValueUtils from '@onekeyhq/shared/src/utils/chainValueUtils';
import type {
  IAddressValidation,
  IGeneralInputValidation,
  INetworkAccountAddressDetail,
  IPrivateKeyValidation,
  IXprvtValidation,
  IXpubValidation,
} from '@onekeyhq/shared/types/address';
import {
  EDecodedTxActionType,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';
import type {
  IDecodedTx,
  IDecodedTxAction,
  IDecodedTxTransferInfo,
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
  IBuildAccountAddressDetailParams,
  IBuildDecodedTxParams,
  IBuildEncodedTxParams,
  IBuildUnsignedTxParams,
  IGetPrivateKeyFromImportedParams,
  IGetPrivateKeyFromImportedResult,
  IUpdateUnsignedTxParams,
  IValidateGeneralInputParams,
} from '../../types';

export default class Vault extends VaultBase {
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

  override async buildEncodedTx(
    params: IBuildEncodedTxParams,
  ): Promise<IEncodedTx> {
    const { transfersInfo } = params;
    if (!transfersInfo || !transfersInfo.length) {
      throw new Error('transfersInfo is required');
    }
    const transfer = transfersInfo[0];
    const tokenInfo = transfer.tokenInfo;
    if (!tokenInfo) {
      throw new Error('tokenInfo is required');
    }

    return {
      Type: 0,
      From: transfer.from,
      To: transfer.to,
      Amount: new BigNumber(transfer.amount)
        .shiftedBy(tokenInfo.decimals)
        .integerValue()
        .toNumber(),
      AccountNonce: 0,
      GasPrice: 1,
      GasLimit: 0,
      Timestamp: 0,
      Payload: '',
    } as IEncodedTxScdo;
  }

  override async buildDecodedTx(
    params: IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const { unsignedTx } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxScdo;
    const account = await this.getAccount();

    let action: IDecodedTxAction = {
      type: EDecodedTxActionType.UNKNOWN,
      unknownAction: {
        from: encodedTx.From,
        to: encodedTx.To,
      },
    };

    const nativeToken = await this.backgroundApi.serviceToken.getNativeToken({
      networkId: this.networkId,
      accountId: this.accountId,
    });

    if (nativeToken) {
      const transfer: IDecodedTxTransferInfo = {
        from: encodedTx.From,
        to: encodedTx.To,
        tokenIdOnNetwork: nativeToken.address,
        icon: nativeToken.logoURI ?? '',
        name: nativeToken.name,
        symbol: nativeToken.symbol,
        amount: chainValueUtils.convertTokenChainValueToAmount({
          value: encodedTx.Amount.toString(),
          token: nativeToken,
        }),
        isNFT: false,
        isNative: true,
      };

      action = await this.buildTxTransferAssetAction({
        from: transfer.from,
        to: transfer.to,
        transfers: [transfer],
      });
    }

    const decodedTx: IDecodedTx = {
      txid: '',
      owner: account.address,
      signer: encodedTx.From || account.address,
      nonce: 0,
      to: encodedTx.To,
      actions: [action],
      status: EDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      encodedTx,
      extraInfo: {},
    };

    return decodedTx;
  }

  override async buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    let { encodedTx } = params;
    if (!encodedTx) {
      encodedTx = await this.buildEncodedTx(params);
    }
    return {
      encodedTx,
    };
  }

  override async updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const encodedTx = params.unsignedTx.encodedTx as IEncodedTxScdo;
    if (params.nonceInfo) {
      encodedTx.AccountNonce = params.nonceInfo.nonce;
    }
    if (params.feeInfo) {
      encodedTx.GasLimit = params.feeInfo.gas?.gasLimit
        ? +params.feeInfo.gas.gasLimit
        : 0;
      encodedTx.GasPrice = params.feeInfo.gas?.gasPrice
        ? new BigNumber(params.feeInfo.gas.gasPrice)
            .shiftedBy(params.feeInfo.common.feeDecimals)
            .integerValue()
            .toNumber()
        : 0;
    }
    // max token send
    if (params.nativeAmountInfo && params.nativeAmountInfo.maxSendAmount) {
      encodedTx.Amount = +params.nativeAmountInfo.maxSendAmount;
    }
    return {
      ...params.unsignedTx,
      encodedTx,
    };
  }

  override async validateAddress(address: string): Promise<IAddressValidation> {
    // from https://github.com/SCDOLAB/scdo.js/blob/88059eb9e0d527cd80715206745c55fb88e3bddd/src/utils.js#L304
    return {
      isValid:
        /^(((1s01|2s02|3s03|4s04|1S01|2S02|3S03|4S04)[a-fA-F0-9]{37}[1-2])|(0[sSx]0{40})|(0x0[1-4][a-fA-F0-9]{37}[1-2]))$/.test(
          address,
        ),
      normalizedAddress: address,
      displayAddress: address,
    };
  }

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
}
