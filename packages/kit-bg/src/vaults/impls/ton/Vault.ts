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
import type { IEstimateFeeParams } from '@onekeyhq/shared/types/fee';
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
import {
  decodePayload,
  encodeJettonPayload,
  getAccountVersion,
  getJettonData,
  getWalletContractClass,
  getWalletContractInstance,
  serializeUnsignedTransaction,
} from './sdkTon/utils';
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
          const fwdFee = ''; // when use forward_payload, need to set fwdFee
          msg.amount = TonWeb.utils.toNano('0.05').toString();
          const jettonAddress = transfer.tokenInfo.address;
          const jettonMasterAddress = new TonWeb.utils.Address(
            transfer.tokenInfo.uniqueKey!,
          ).toString(true, true, true);
          const { payload } = await encodeJettonPayload({
            backgroundApi: this.backgroundApi,
            networkId: network.id,
            address: fromAddress,
            jettonAddress,
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
            jettonMasterAddress,
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
          let tokenAddress = message.jetton?.jettonMasterAddress ?? '';
          let to = message.toAddress;
          let amount = message.amount.toString();
          if (decodedPayload.jetton) {
            to = decodedPayload.jetton.toAddress;
            amount = decodedPayload.jetton.amount;
            const jettonData = await getJettonData({
              backgroundApi: this.backgroundApi,
              networkId: network.id,
              address: from,
            }).catch((e) => {
              console.error(e);
            });
            if (jettonData) {
              tokenAddress = jettonData.jettonMinterAddress.toString();
            }
          }
          const token = await this.backgroundApi.serviceToken.getToken({
            networkId: network.id,
            accountId: this.accountId,
            tokenIdOnNetwork: tokenAddress,
          });
          if (token) {
            amount = new BigNumber(amount).shiftedBy(-token.decimals).toFixed();
          }
          return this.buildTxTransferAssetAction({
            from,
            to,
            transfers: [
              {
                from,
                to,
                amount,
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

    if (encodedTx.sequenceNo === 0 && !encodedTx.messages[0].stateInit) {
      const account = await this.getAccount();
      const wallet = getWalletContractInstance({
        version: getAccountVersion(account.id),
        publicKey: account.pub ?? '',
        backgroundApi: this.backgroundApi,
        networkId: this.networkId,
      });
      const stateInit = await wallet.createStateInit();
      encodedTx.messages[0].stateInit = Buffer.from(
        await stateInit.stateInit.toBoc(),
      ).toString('hex');
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

    if (params.nativeAmountInfo && params.nativeAmountInfo.maxSendAmount) {
      const network = await this.getNetwork();
      const jetton = encodedTx.messages[0].jetton;
      const token = await this.backgroundApi.serviceToken.getToken({
        networkId: network.id,
        accountId: this.accountId,
        tokenIdOnNetwork: jetton ? jetton.jettonMasterAddress : '',
      });
      const amount = new BigNumber(params.nativeAmountInfo.maxSendAmount)
        .shiftedBy(token?.decimals ?? 0)
        .toFixed(0, BigNumber.ROUND_FLOOR);
      if (encodedTx.messages[0].jetton) {
        encodedTx.messages[0].jetton.amount = amount;
      } else {
        encodedTx.messages[0].amount = amount;
      }
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

  override async buildEstimateFeeParams(params: {
    encodedTx: IEncodedTx | undefined;
  }): Promise<{
    encodedTx: IEncodedTx | undefined;
    estimateFeeParams?: IEstimateFeeParams;
  }> {
    const encodedTx = params.encodedTx as IEncodedTxTon;
    const account = await this.getAccount();
    const version = getAccountVersion(account.id);
    const serializeUnsignedTx = await serializeUnsignedTransaction({
      version,
      encodedTx,
      backgroundApi: this.backgroundApi,
      networkId: this.networkId,
    });
    return {
      encodedTx: {
        body: Buffer.from(await serializeUnsignedTx.body.toBoc(false)).toString(
          'base64',
        ),
        ignore_chksig: true,
        init_code: serializeUnsignedTx.code
          ? Buffer.from(await serializeUnsignedTx.code.toBoc(false)).toString(
              'base64',
            )
          : undefined,
        init_data: serializeUnsignedTx.data
          ? Buffer.from(await serializeUnsignedTx.data.toBoc(false)).toString(
              'base64',
            )
          : undefined,
      } as unknown as IEncodedTx,
    };
  }
}
