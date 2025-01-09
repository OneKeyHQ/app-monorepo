/* eslint-disable @typescript-eslint/no-unused-vars */
import BigNumber from 'bignumber.js';

import type { IEncodedTxScdo } from '@onekeyhq/core/src/chains/scdo/types';
import type {
  IEncodedTx,
  ISignedTxPro,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import {
  NotImplemented,
  OneKeyInternalError,
} from '@onekeyhq/shared/src/errors';
import chainValueUtils from '@onekeyhq/shared/src/utils/chainValueUtils';
import type {
  IAddressValidation,
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
import { ClientScdo } from './sdkScdo/ClientScdo';
import { decodeTransferPayload, encodeTransferPayload } from './utils';

import type { IDBWalletType } from '../../../dbs/local/types';
import type { KeyringBase } from '../../base/KeyringBase';
import type {
  IBroadcastTransactionByCustomRpcParams,
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

    let amount = new BigNumber(transfer.amount)
      .shiftedBy(tokenInfo.decimals ?? 0)
      .toFixed(0, BigNumber.ROUND_FLOOR);

    let Payload = '';
    let toAddress = transfer.to;
    if (!tokenInfo.isNative) {
      toAddress = tokenInfo.address;
      Payload = encodeTransferPayload({
        address: transfer.to,
        amount,
      });
      amount = '0';
    }

    return {
      Type: 0,
      From: transfer.from,
      To: toAddress,
      Amount: Number(amount),
      AccountNonce: 0,
      GasPrice: 1,
      GasLimit: 0,
      Timestamp: 0,
      Payload,
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

    let tokenInfo;
    let amount = new BigNumber(encodedTx.Amount).toFixed();
    let isNative = true;
    let toAddress = encodedTx.To;
    if (encodedTx.Payload && encodedTx.Amount === 0) {
      const transfer = decodeTransferPayload(encodedTx.Payload);
      if (transfer) {
        isNative = false;
        amount = transfer.amount;
        toAddress = transfer.address;
        tokenInfo = await this.backgroundApi.serviceToken.getToken({
          networkId: this.networkId,
          accountId: this.accountId,
          tokenIdOnNetwork: encodedTx.To,
        });
      }
    } else {
      tokenInfo = await this.backgroundApi.serviceToken.getNativeToken({
        networkId: this.networkId,
        accountId: this.accountId,
      });
    }
    if (tokenInfo) {
      const transfer: IDecodedTxTransferInfo = {
        from: encodedTx.From,
        to: toAddress,
        tokenIdOnNetwork: tokenInfo.address,
        icon: tokenInfo.logoURI ?? '',
        name: tokenInfo.name,
        symbol: tokenInfo.symbol,
        amount: chainValueUtils.convertTokenChainValueToAmount({
          value: amount,
          token: tokenInfo,
        }),
        isNFT: false,
        isNative,
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
    } else {
      encodedTx.AccountNonce += 1;
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
      let isSendToken = false;
      if (encodedTx.Amount === 0 && encodedTx.Payload) {
        const transfer = decodeTransferPayload(encodedTx.Payload);
        if (transfer) {
          isSendToken = true;
          const token = await this.backgroundApi.serviceToken.getToken({
            networkId: this.networkId,
            accountId: this.accountId,
            tokenIdOnNetwork: encodedTx.To,
          });
          if (token) {
            transfer.amount = chainValueUtils.convertTokenAmountToChainValue({
              value: params.nativeAmountInfo.maxSendAmount,
              token,
              decimalPlaces: 0,
              roundingMode: BigNumber.ROUND_FLOOR,
            });
            encodedTx.Payload = encodeTransferPayload(transfer);
          }
        }
      }
      if (!isSendToken) {
        const network = await this.getNetwork();
        encodedTx.Amount = Number(
          chainValueUtils.convertAmountToChainValue({
            value: params.nativeAmountInfo.maxSendAmount,
            network,
          }),
        );
      }
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

  override async getCustomRpcEndpointStatus(
    params: IMeasureRpcStatusParams,
  ): Promise<IMeasureRpcStatusResult> {
    const client = new ClientScdo({ url: params.rpcUrl });
    const start = performance.now();
    const { blockHeight } = await client.getBlockHeight();
    return {
      responseTime: Math.floor(performance.now() - start),
      bestBlockNumber: blockHeight,
    };
  }

  override async broadcastTransactionFromCustomRpc(
    params: IBroadcastTransactionByCustomRpcParams,
  ): Promise<ISignedTxPro> {
    const { customRpcInfo, signedTx } = params;
    const rpcUrl = customRpcInfo.rpc;
    if (!rpcUrl) {
      throw new OneKeyInternalError('Invalid rpc url');
    }
    const client = new ClientScdo({ url: rpcUrl });
    const tx = JSON.parse(
      Buffer.from(signedTx.rawTx, 'base64').toString('utf8'),
    );
    await client.broadcastTransaction(tx);
    console.log('broadcastTransaction END:', {
      txid: signedTx.txid,
      rawTx: signedTx.rawTx,
    });
    return {
      ...params.signedTx,
      txid: signedTx.txid,
    };
  }
}
