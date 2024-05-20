import BigNumber from 'bignumber.js';
import { isEmpty } from 'lodash';

import { XRPL } from '@onekeyhq/core/src/chains/xrp/sdkXrp';
import type { IEncodedTxXrp } from '@onekeyhq/core/src/chains/xrp/types';
import {
  decodeSensitiveText,
  encodeSensitiveText,
} from '@onekeyhq/core/src/secret';
import type { ISignedTxPro, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import {
  InvalidAddress,
  OneKeyInternalError,
} from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
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
  override keyringMap: Record<IDBWalletType, typeof KeyringBase> = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringExternal,
  };

  override buildAccountAddressDetail(
    params: IBuildAccountAddressDetailParams,
  ): Promise<INetworkAccountAddressDetail> {
    const { account, networkId } = params;
    const { address } = account;
    return Promise.resolve({
      networkId,
      normalizedAddress: address,
      displayAddress: address,
      address,
      baseAddress: address,
      isValid: true,
      allowEmptyAddress: false,
    });
  }

  override async buildEncodedTx(
    params: IBuildEncodedTxParams,
  ): Promise<IEncodedTxXrp> {
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
    let destination = to;
    let destinationTag: number | undefined = transferInfo.destinationTag
      ? Number(transferInfo.destinationTag)
      : undefined;
    // Slice destination tag from swap address
    if (!XRPL.isValidAddress(to) && to.indexOf('#') > -1) {
      const [address, tag] = to.split('#');
      destination = address;
      destinationTag = tag ? Number(tag) : undefined;

      if (!XRPL.isValidAddress(address)) {
        throw new InvalidAddress();
      }
    }

    const [currentLedgerIndex] =
      await this.backgroundApi.serviceAccountProfile.sendProxyRequest<number>({
        networkId: this.networkId,
        body: [
          {
            route: 'rpc',
            params: {
              method: 'getLedgerIndex',
              params: [],
            },
          },
        ],
      });
    const [prepared] =
      await this.backgroundApi.serviceAccountProfile.sendProxyRequest<
        Awaited<ReturnType<XRPL.Client['autofill']>>
      >({
        networkId: this.networkId,
        body: [
          {
            route: 'rpc',
            params: {
              method: 'autofill',
              params: [
                {
                  TransactionType: 'Payment',
                  Account: dbAccount.address,
                  Amount: XRPL.xrpToDrops(amount),
                  Destination: destination,
                  DestinationTag: destinationTag,
                  LastLedgerSequence: currentLedgerIndex + 50,
                },
              ],
            },
          },
        ],
      });

    return {
      ...prepared,
    } as IEncodedTxXrp;
  }

  override async buildDecodedTx(
    params: IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const { unsignedTx } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxXrp;
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

    const decodedTx: IDecodedTx = {
      txid: '',
      owner: encodedTx.Account,
      signer: encodedTx.Account,
      nonce: 0,
      actions: [
        {
          type: EDecodedTxActionType.ASSET_TRANSFER,
          assetTransfer: {
            from: encodedTx.Account,
            to: encodedTx.Destination,
            sends: [
              {
                from: encodedTx.Account,
                to: encodedTx.Destination,
                isNative: true,
                tokenIdOnNetwork: '',
                name: nativeToken.name,
                icon: nativeToken.logoURI ?? '',
                amount: new BigNumber(encodedTx.Amount)
                  .shiftedBy(-network.decimals)
                  .toFixed(),
                symbol: network.symbol,
              },
            ],
            receives: [],
          },
        },
      ],
      status: EDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      extraInfo: null,
      payload: {
        type: EOnChainHistoryTxType.Send,
      },
      encodedTx,
    };

    return decodedTx;
  }

  override async buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const encodedTx = await this.buildEncodedTx(params);
    if (encodedTx) {
      return {
        encodedTx,
        transfersInfo: params.transfersInfo,
      };
    }
    throw new Error('Method not implemented.');
  }

  override updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    return Promise.resolve(params.unsignedTx);
  }

  override validateAddress(address: string): Promise<IAddressValidation> {
    if (XRPL.isValidClassicAddress(address)) {
      return Promise.resolve({
        isValid: true,
        normalizedAddress: address,
        displayAddress: address,
      });
    }
    return Promise.reject(new InvalidAddress());
  }

  override validateXpub(): Promise<IXpubValidation> {
    return Promise.resolve({
      isValid: false,
    });
  }

  override getPrivateKeyFromImported(
    params: IGetPrivateKeyFromImportedParams,
  ): Promise<IGetPrivateKeyFromImportedResult> {
    const input = decodeSensitiveText({ encodedText: params.input });
    let privateKey = bufferUtils.bytesToHex(input);
    privateKey = encodeSensitiveText({ text: privateKey });
    return Promise.resolve({ privateKey });
  }

  override validateXprvt(): Promise<IXprvtValidation> {
    return Promise.resolve({
      isValid: false,
    });
  }

  override validatePrivateKey(
    privateKey: string,
  ): Promise<IPrivateKeyValidation> {
    const isValid = /^(00)?[0-9a-zA-Z]{64}$/.test(privateKey);
    return Promise.resolve({ isValid });
  }

  override async validateGeneralInput(
    params: IValidateGeneralInputParams,
  ): Promise<IGeneralInputValidation> {
    const { result } = await this.baseValidateGeneralInput(params);
    return result;
  }
}
