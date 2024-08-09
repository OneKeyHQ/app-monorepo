/* eslint-disable @typescript-eslint/no-unused-vars */
import BigNumber from 'bignumber.js';
import TonWeb from 'tonweb';

import { genAddressFromAddress } from '@onekeyhq/core/src/chains/ton/sdkTon';
import type { IEncodedTxTon } from '@onekeyhq/core/src/chains/ton/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { IEncodedTx, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
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
  EDecodedTxDirection,
  EDecodedTxStatus,
  type IDecodedTx,
} from '@onekeyhq/shared/types/tx';

import { VaultBase } from '../../base/VaultBase';

import { KeyringExternal } from './KeyringExternal';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import { decodePayload, encodeJettonPayload } from './sdkTon/utils';
import settings from './settings';

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
  override coreApi = coreChainApi.ton.hd;

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
    const { account, networkId, externalAccountAddress } = params;
    const address = account.address || externalAccountAddress || '';
    const { normalizedAddress, displayAddress, isValid } =
      await this.validateAddress(address);
    return {
      networkId,
      normalizedAddress,
      displayAddress,
      address: displayAddress,
      baseAddress: normalizedAddress,
      isValid,
      allowEmptyAddress: false,
    };
  }

  override async buildEncodedTx(
    params: IBuildEncodedTxParams,
  ): Promise<IEncodedTx> {
    const { transfersInfo } = params;
    if (!transfersInfo) {
      throw new OneKeyInternalError('Invalid transfersInfo');
    }
    const network = await this.getNetwork();
    const fromAddress = await this.getAccountAddress();
    const messages = await Promise.all(
      transfersInfo.map(async (transfer) => {
        const amount = new BigNumber(transfer.amount)
          .shiftedBy(transfer.tokenInfo?.decimals || 0)
          .toFixed(0);
        const msg: IEncodedTxTon['messages'][0] = {
          toAddress: transfer.to,
          amount,
          sendMode: 0,
        };
        if (
          transfer.tokenInfo?.symbol &&
          network.symbol !== transfer.tokenInfo.symbol
        ) {
          const fwdFee = TonWeb.utils.toNano('0.01').toString();
          msg.amount = TonWeb.utils.toNano('0.05').toString();
          const { payload, jettonAddress } = await encodeJettonPayload({
            backgroundApi: this.backgroundApi,
            address: fromAddress,
            masterAddress: transfer.tokenInfo.address,
            params: {
              tokenAmount: amount,
              forwardAmount: fwdFee,
              toAddress: transfer.to,
              responseAddress: fromAddress,
            },
          });
          msg.payload = payload;
          msg.toAddress = jettonAddress;
          msg.jetton = {
            amount,
            jettonMasterAddress: transfer.tokenInfo.address,
            fwdFee,
          };
        }
        return msg;
      }),
    );

    return {
      fromAddress,
      messages,
      sequenceNo: 0,
    };
  }

  override async buildDecodedTx(
    params: IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const encodedTx = params.unsignedTx.encodedTx as IEncodedTxTon;
    const from = await this.getAccountAddress();
    const network = await this.getNetwork();
    const actions = await Promise.all(
      encodedTx.messages.map(async (message) => {
        const decodedPayload = decodePayload(message.payload);
        if (decodedPayload.type === EDecodedTxActionType.ASSET_TRANSFER) {
          const token = await this.backgroundApi.serviceToken.getToken({
            networkId: network.id,
            accountId: this.accountId,
            tokenIdOnNetwork: decodedPayload.tokenAddress ?? '',
          });
          return this.buildTxTransferAssetAction({
            from,
            to: message.toAddress,
            transfers: [
              {
                from,
                to: message.toAddress,
                amount: message.amount.toString(),
                icon: token?.logoURI ?? '',
                symbol: token?.symbol ?? '',
                name: token?.name ?? '',
                tokenIdOnNetwork: token?.address ?? '',
                isNative: token?.symbol === network.symbol,
              },
            ],
          });
        }
        return {
          type: EDecodedTxActionType.UNKNOWN,
          direction: EDecodedTxDirection.OTHER,
          unknownAction: {
            from,
            to: message.toAddress,
          },
        };
      }),
    );

    const feeInfo = params.unsignedTx.feeInfo;

    return {
      txid: '',
      owner: from,
      signer: from,
      nonce: encodedTx.sequenceNo,
      actions,
      status: EDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      feeInfo: {
        common: {
          feeDecimals: network.decimals,
          feeSymbol: network.symbol,
          nativeDecimals: network.decimals,
          nativeSymbol: network.symbol,
        },
        gas: {
          gasPrice: feeInfo?.gas?.gasPrice ?? '0',
          gasLimit: feeInfo?.gas?.gasLimit ?? '0',
        },
      },
      extraInfo: null,
      encodedTx,
    };
  }

  override async buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const encodedTx = params.encodedTx ?? (await this.buildEncodedTx(params));
    if (encodedTx) {
      return {
        encodedTx,
        transfersInfo: params.transfersInfo ?? [],
      };
    }
    throw new OneKeyInternalError();
  }

  override async updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const encodedTx = params.unsignedTx.encodedTx as IEncodedTxTon;
    if (params.nonceInfo) {
      encodedTx.sequenceNo = params.nonceInfo.nonce;
    }
    const expireAt = Math.floor(Date.now() / 1000) + 60 * 3;
    if (!encodedTx.expireAt) {
      encodedTx.expireAt = expireAt;
    } else if (encodedTx.expireAt.toString().length > 10) {
      encodedTx.expireAt = Math.floor(encodedTx.expireAt / 1000);
    }
    if (encodedTx.expireAt < expireAt) {
      encodedTx.expireAt = expireAt;
    }
    return {
      ...params.unsignedTx,
    };
  }

  override async validateAddress(address: string): Promise<IAddressValidation> {
    const isValid = TonWeb.Address.isValid(address);
    const addr = isValid ? await genAddressFromAddress(address) : null;
    let normalizedAddress = '';
    let displayAddress = '';
    if (addr) {
      normalizedAddress = addr.normalAddress;
      displayAddress = addr.nonBounceAddress;
    }
    return {
      isValid,
      normalizedAddress,
      displayAddress,
    };
  }

  override async validateXpub(xpub: string): Promise<IXpubValidation> {
    return {
      isValid: false,
    };
  }

  override getPrivateKeyFromImported(
    params: IGetPrivateKeyFromImportedParams,
  ): Promise<IGetPrivateKeyFromImportedResult> {
    return this.baseGetPrivateKeyFromImported(params);
  }

  override async validateXprvt(xprvt: string): Promise<IXprvtValidation> {
    return {
      isValid: false,
    };
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
    result.deriveInfoItems = Object.values(settings.accountDeriveInfo);
    return result;
  }
}
