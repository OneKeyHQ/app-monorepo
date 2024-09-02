/* eslint-disable @typescript-eslint/no-unused-vars */
import { AddressType, bs58, isValidAddress } from '@alephium/web3';
import BigNumber from 'bignumber.js';

import {
  EAlphTxType,
  type IEncodedTxAlph,
} from '@onekeyhq/core/src/chains/alph/types';
import type { IEncodedTx, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { EAddressEncodings } from '@onekeyhq/core/src/types';
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
import {
  EDecodedTxActionType,
  EDecodedTxDirection,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';
import type {
  IDecodedTx,
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
import type { SignTransferTxParams } from '@alephium/web3';

export default class Vault extends VaultBase {
  override keyringMap: Record<IDBWalletType, typeof KeyringBase | undefined> = {
    hd: KeyringHd,
    qr: undefined, // KeyringQr,
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
    if (!transfersInfo) {
      throw new OneKeyInternalError('Invalid transfersInfo');
    }
    const network = await this.getNetwork();
    const signerAddress = await this.getAccountAddress();
    const transfer = transfersInfo[0];
    const amount = new BigNumber(transfer.amount)
      .shiftedBy(transfer.tokenInfo?.decimals ?? 0)
      .toFixed(0);
    const encodedTx: SignTransferTxParams = {
      signerAddress,
      destinations: [
        {
          address: transfer.to,
          attoAlphAmount: amount,
        },
      ],
    };

    if (transfer.tokenInfo?.isNative) {
      encodedTx.destinations[0].attoAlphAmount = '0';
      encodedTx.destinations[0].tokens = [
        {
          id: transfer.tokenInfo?.address ?? '',
          amount,
        },
      ];
    }
    return {
      type: EAlphTxType.Transfer,
      params: encodedTx,
    };
  }

  override async buildDecodedTx(
    params: IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const encodedTx = params.unsignedTx.encodedTx as IEncodedTxAlph;
    const from = encodedTx.params.signerAddress;
    const actions: IDecodedTx['actions'] = [];
    const network = await this.getNetwork();
    if (encodedTx.type === EAlphTxType.Transfer) {
      const destinations = (encodedTx.params as SignTransferTxParams)
        .destinations;
      const token = await this.backgroundApi.serviceToken.getNativeToken({
        networkId: network.id,
        accountId: this.accountId,
      });
      const transfers: IDecodedTxTransferInfo[] = [];
      await Promise.all(
        destinations.map(async (dest) => {
          if (dest.attoAlphAmount.toString() !== '0') {
            transfers.push({
              from,
              to: dest.address,
              amount: chainValueUtils.convertChainValueToAmount({
                value: dest.attoAlphAmount.toString(),
                network,
              }),
              icon: token?.logoURI ?? '',
              symbol: token?.symbol ?? '',
              name: token?.name ?? '',
              tokenIdOnNetwork: token?.address ?? '',
              isNative: true,
            });
          }
          if (dest.tokens) {
            await Promise.all(
              dest.tokens.map(async (tokenData) => {
                const tokenInfo =
                  await this.backgroundApi.serviceToken.getToken({
                    networkId: network.id,
                    accountId: this.accountId,
                    tokenIdOnNetwork: tokenData.id,
                  });
                if (tokenInfo) {
                  transfers.push({
                    from,
                    to: dest.address,
                    amount: chainValueUtils.convertTokenChainValueToAmount({
                      value: tokenData.amount.toString(),
                      token: tokenInfo,
                    }),
                    icon: tokenInfo.logoURI ?? '',
                    symbol: tokenInfo.symbol ?? '',
                    name: tokenInfo.name ?? '',
                    tokenIdOnNetwork: tokenInfo.address ?? '',
                    isNative: false,
                  });
                }
              }),
            );
          }
        }),
      );
      actions.push(
        await this.buildTxTransferAssetAction({
          from,
          to: destinations[0].address,
          transfers,
        }),
      );
    } else {
      actions.push({
        type: EDecodedTxActionType.UNKNOWN,
        direction: EDecodedTxDirection.OTHER,
        unknownAction: {
          from,
          to: '',
        },
      });
    }
    return {
      txid: '',
      owner: from,
      signer: from,
      nonce: 0,
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
          gasPrice: encodedTx.params.gasPrice?.toString() ?? '0',
          gasLimit: encodedTx.params.gasAmount?.toString() ?? '0',
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
    const encodedTx = params.unsignedTx.encodedTx as IEncodedTxAlph;
    if (params.feeInfo) {
      encodedTx.params.gasPrice = params.feeInfo.gas?.gasPrice;
      encodedTx.params.gasAmount = Number(params.feeInfo.gas?.gasLimit);
    }

    // max amount
    if (params.nativeAmountInfo && params.nativeAmountInfo.maxSendAmount) {
      const txParams = encodedTx.params as SignTransferTxParams;
      if (txParams.destinations[0].attoAlphAmount.toString() !== '0') {
        const network = await this.getNetwork();
        txParams.destinations[0].attoAlphAmount =
          chainValueUtils.convertAmountToChainValue({
            value: params.nativeAmountInfo.maxSendAmount,
            network,
          });
      } else {
        if (!txParams.destinations[0].tokens) {
          throw new OneKeyInternalError('No tokens found');
        }
        const token = await this.backgroundApi.serviceToken.getToken({
          networkId: this.networkId,
          accountId: this.accountId,
          tokenIdOnNetwork: txParams.destinations[0].tokens[0].id,
        });
        txParams.destinations[0].tokens[0].amount = new BigNumber(
          params.nativeAmountInfo.maxSendAmount,
        )
          .shiftedBy(token?.decimals ?? 0)
          .toFixed(0, BigNumber.ROUND_FLOOR);
      }
    }

    return {
      ...params.unsignedTx,
      encodedTx,
    };
  }

  override validateAddress(address: string): Promise<IAddressValidation> {
    const isValid = isValidAddress(address);
    let encoding: EAddressEncodings | undefined;

    if (isValid) {
      const decoded = bs58.decode(address);
      const addressType = decoded[0];

      if (addressType === AddressType.P2PKH) {
        encoding = EAddressEncodings.ALPH_P2PKH;
      } else if (addressType === AddressType.P2SH) {
        encoding = EAddressEncodings.ALPH_P2SH;
      } else if (addressType === AddressType.P2MPKH) {
        encoding = EAddressEncodings.ALPH_P2MPKH;
      } else if (addressType === AddressType.P2C) {
        encoding = EAddressEncodings.ALPH_P2C;
      }

      return Promise.resolve({
        isValid,
        normalizedAddress: address,
        displayAddress: address,
        encoding,
      });
    }

    return Promise.resolve({
      isValid: false,
      normalizedAddress: '',
      displayAddress: '',
    });
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
