/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  starcoin_types as StarcoinTypes,
  encoding,
  utils,
} from '@starcoin/starcoin';
import BigNumber from 'bignumber.js';
import { isEmpty, isNil } from 'lodash';

import type { IEncodedTxStc } from '@onekeyhq/core/src/chains/stc/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import {
  EAddressEncodings,
  type ISignedTxPro,
  type IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import chainValueUtils from '@onekeyhq/shared/src/utils/chainValueUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IAddressValidation,
  IGeneralInputValidation,
  INetworkAccountAddressDetail,
  IPrivateKeyValidation,
  IXprvtValidation,
  IXpubValidation,
} from '@onekeyhq/shared/types/address';
import type { IFeeInfoUnit } from '@onekeyhq/shared/types/fee';
import {
  EDecodedTxActionType,
  EDecodedTxStatus,
  type IDecodedTx,
  type IDecodedTxAction,
  type IDecodedTxTransferInfo,
} from '@onekeyhq/shared/types/tx';

import { VaultBase } from '../../base/VaultBase';

import { KeyringExternal } from './KeyringExternal';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import ClientStc from './sdkStc/ClientStc';
import { decodeTransactionPayload, encodeTokenTransferData } from './utils';

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
  INativeAmountInfo,
  ITransferInfo,
  IUpdateUnsignedTxParams,
  IValidateGeneralInputParams,
  IVaultSettings,
} from '../../types';

const NATIVE_TOKEN_ADDRESS = '0x00000000000000000000000000000001::STC::STC';

export default class Vault extends VaultBase {
  override coreApi = coreChainApi.stc.hd;

  override keyringMap: Record<IDBWalletType, typeof KeyringBase> = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringExternal,
  };

  async getClient() {
    return this.getClientCache();
  }

  private getClientCache = memoizee(
    async () =>
      new ClientStc({
        backgroundApi: this.backgroundApi,
        networkId: this.networkId,
      }),
    {
      maxAge: timerUtils.getTimeDurationMs({ minute: 3 }),
    },
  );

  override async buildAccountAddressDetail(
    params: IBuildAccountAddressDetailParams,
  ): Promise<INetworkAccountAddressDetail> {
    const { account, networkId } = params;

    const address = account.address || '';

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

  override buildEncodedTx(
    params: IBuildEncodedTxParams,
  ): Promise<IEncodedTxStc> {
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

  async _buildEncodedTxFromTransfer(params: {
    transferInfo: ITransferInfo;
  }): Promise<IEncodedTxStc> {
    const { transferInfo } = params;
    const { tokenInfo, from, to, amount } = transferInfo;

    if (!transferInfo.to) {
      throw new Error('buildEncodedTx ERROR: transferInfo.to is missing');
    }

    if (!tokenInfo) {
      throw new Error(
        'buildEncodedTx ERROR: transferInfo.tokenInfo is missing',
      );
    }

    const network = await this.getNetwork();

    if (tokenInfo.isNative) {
      return Promise.resolve({
        from,
        to,
        value: chainValueUtils.convertAmountToChainValue({
          value: amount,
          network,
        }),
      });
    }

    return Promise.resolve({
      from,
      to: '',
      value: '',
      data: encodeTokenTransferData({
        to,
        token: tokenInfo,
        amount,
      }),
    });
  }

  override async buildDecodedTx(
    params: IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const { unsignedTx } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxStc;
    const accountAddress = await this.getAccountAddress();

    const { data, to } = encodedTx;
    let action: IDecodedTxAction = {
      type: EDecodedTxActionType.UNKNOWN,
    };
    if (to) {
      const transferNativeTokenAction =
        await this._buildTxTransferNativeTokenAction({ encodedTx });
      if (transferNativeTokenAction) {
        action = transferNativeTokenAction;
      }
    } else if (data) {
      const decodedPayload = decodeTransactionPayload(data);
      if (decodedPayload.type === 'tokenTransfer') {
        const {
          tokenAddress,
          to: transferTo,
          amountValue,
        } = decodedPayload.payload;

        if (tokenAddress === NATIVE_TOKEN_ADDRESS) {
          const transferNativeTokenAction =
            await this._buildTxTransferNativeTokenAction({
              encodedTx: {
                ...encodedTx,
                to: transferTo,
                value: amountValue,
              },
            });
          if (transferNativeTokenAction) {
            action = transferNativeTokenAction;
          }
        } else {
          const transferTokenAction = await this._buildTxTransferTokenAction({
            encodedTx,
            tokenAddress,
            amountValue,
            transferTo,
          });
          if (transferTokenAction) {
            action = transferTokenAction;
          }
        }
      }
    }

    const result: IDecodedTx = {
      txid: '',
      owner: accountAddress,
      signer: encodedTx.from ?? accountAddress,
      to: encodedTx.to,
      nonce: 0,
      actions: [action],
      status: EDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,

      extraInfo: null,
      encodedTx,
      payload: {
        data: encodedTx.data,
      },
    };

    return Promise.resolve(result);
  }

  async _buildTxTransferTokenAction(params: {
    encodedTx: IEncodedTxStc;
    amountValue: string;
    tokenAddress: string;
    transferTo: string;
  }) {
    const { encodedTx, amountValue, tokenAddress, transferTo } = params;
    const accountAddress = await this.getAccountAddress();
    const token = await this.backgroundApi.serviceToken.getToken({
      networkId: this.networkId,
      accountAddress,
      tokenIdOnNetwork: tokenAddress,
    });

    if (!token) return;

    const transfer: IDecodedTxTransferInfo = {
      from: encodedTx.from ?? accountAddress,
      to: transferTo,
      tokenIdOnNetwork: token.address,
      icon: token.logoURI ?? '',
      name: token.name,
      symbol: token.symbol,
      amount: chainValueUtils.convertTokenChainValueToAmount({
        value: amountValue,
        token,
      }),
      isNFT: false,
    };

    const action = await this.buildTxTransferAssetAction({
      from: encodedTx.from,
      to: encodedTx.to,
      transfers: [transfer],
    });

    return action;
  }

  async _buildTxTransferNativeTokenAction(params: {
    encodedTx: IEncodedTxStc;
  }) {
    const { encodedTx } = params;
    const accountAddress = await this.getAccountAddress();
    const nativeToken = await this.backgroundApi.serviceToken.getToken({
      networkId: this.networkId,
      accountAddress,
      tokenIdOnNetwork: NATIVE_TOKEN_ADDRESS,
    });

    if (!nativeToken) return;

    const transfer: IDecodedTxTransferInfo = {
      from: encodedTx.from ?? accountAddress,
      to: encodedTx.to,
      tokenIdOnNetwork: nativeToken.address,
      icon: nativeToken.logoURI ?? '',
      name: nativeToken.name,
      symbol: nativeToken.symbol,
      amount: new BigNumber(encodedTx.value)
        .shiftedBy(-nativeToken.decimals)
        .toFixed(),
      isNFT: false,
      isNative: true,
    };

    const action = await this.buildTxTransferAssetAction({
      from: encodedTx.from ?? accountAddress,
      to: encodedTx.to,
      transfers: [transfer],
    });

    return action;
  }

  override async buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const encodedTx = params.encodedTx ?? (await this.buildEncodedTx(params));
    if (encodedTx) {
      return this._buildUnsignedTxFromEncodedTx(encodedTx as IEncodedTxStc);
    }
    throw new OneKeyInternalError();
  }

  async _buildUnsignedTxFromEncodedTx(
    encodedTx: IEncodedTxStc,
  ): Promise<IUnsignedTxPro> {
    const tx = { ...encodedTx };
    const client = await this.getClient();
    const account = await this.getAccount();
    let txPayload: StarcoinTypes.TransactionPayload;

    if (tx.data) {
      txPayload = encoding.bcsDecode(StarcoinTypes.TransactionPayload, tx.data);
    } else {
      let toAddr = encodedTx.to;
      const amount = encodedTx.value;
      if (toAddr.startsWith('stc')) {
        const riv = encoding.decodeReceiptIdentifier(toAddr);
        toAddr = riv.accountAddress.startsWith('0x')
          ? riv.accountAddress
          : `0x${riv.accountAddress}`;
      }
      const typeArgs = ['0x1::STC::STC'];
      const functionId = '0x1::TransferScripts::peer_to_peer_v2';
      const args = [toAddr, BigInt(amount)];
      const tyArgs = utils.tx.encodeStructTypeTags(typeArgs);
      const { args: argsType } = await client.callContract<{
        args: { type_tag: string }[];
      }>({
        method: 'resolve_function',
        params: [functionId],
      });

      if (argsType[0] && argsType[0].type_tag === 'Signer') {
        argsType.shift();
      }

      const argsBytes = utils.tx.encodeScriptFunctionArgs(argsType, args);

      const scriptFunction = utils.tx.encodeScriptFunction(
        functionId,
        tyArgs,
        argsBytes,
      );

      txPayload = scriptFunction;
    }

    return Promise.resolve({
      encodedTx: tx,
      nonce: isNil(tx.nonce) ? tx.nonce : new BigNumber(tx.nonce).toNumber(),
      payload: {
        txPayload,
        expirationTime: Math.floor(Date.now() / 1000) + 60 * 60,
        senderPublicKey: account.pub,
      },
    });
  }

  override async updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const { unsignedTx, feeInfo, nonceInfo, nativeAmountInfo } = params;
    let encodedTxNew = unsignedTx.encodedTx as IEncodedTxStc;

    if (feeInfo) {
      encodedTxNew = await this._attachFeeInfoToEncodedTx({
        encodedTx: encodedTxNew,
        feeInfo,
      });
    }

    if (nonceInfo) {
      encodedTxNew = await this._attachNonceInfoToEncodedTx({
        encodedTx: encodedTxNew,
        nonceInfo,
      });
      unsignedTx.nonce = nonceInfo.nonce;
    }

    if (nativeAmountInfo) {
      encodedTxNew = await this._updateNativeTokenAmount({
        encodedTx: encodedTxNew,
        nativeAmountInfo,
      });
    }

    unsignedTx.encodedTx = encodedTxNew;
    return unsignedTx;
  }

  async _attachFeeInfoToEncodedTx(params: {
    encodedTx: IEncodedTxStc;
    feeInfo: IFeeInfoUnit;
  }): Promise<IEncodedTxStc> {
    const { encodedTx, feeInfo } = params;
    const network = await this.getNetwork();

    let encodedTxWithFee = encodedTx;

    if (feeInfo.gas) {
      encodedTxWithFee = {
        ...encodedTxWithFee,
        gasPrice: chainValueUtils.convertGweiToChainValue({
          value: feeInfo.gas.gasPrice,
          network,
        }),
        gasLimit: feeInfo.gas.gasLimit,
      };
    }
    return Promise.resolve(encodedTxWithFee);
  }

  async _attachNonceInfoToEncodedTx(params: {
    encodedTx: IEncodedTxStc;
    nonceInfo: { nonce: number };
  }): Promise<IEncodedTxStc> {
    const { encodedTx, nonceInfo } = params;
    const tx = {
      ...encodedTx,
      nonce: nonceInfo.nonce,
    };

    return Promise.resolve(tx);
  }

  async _updateNativeTokenAmount(params: {
    encodedTx: IEncodedTxStc;
    nativeAmountInfo: INativeAmountInfo;
  }) {
    const { encodedTx, nativeAmountInfo } = params;
    const network = await this.getNetwork();

    let newValue = encodedTx.value;

    if (!isNil(nativeAmountInfo.maxSendAmount)) {
      newValue = chainValueUtils.convertAmountToChainValue({
        value: nativeAmountInfo.maxSendAmount,
        network,
      });
    }

    const tx = {
      ...encodedTx,
      value: newValue,
    };
    return Promise.resolve(tx);
  }

  override broadcastTransaction(
    params: IBroadcastTransactionParams,
  ): Promise<ISignedTxPro> {
    throw new Error('Method not implemented.');
  }

  override async validateAddress(address: string): Promise<IAddressValidation> {
    if (address.startsWith('stc')) {
      try {
        const riv = encoding.decodeReceiptIdentifier(address);
        return {
          normalizedAddress: `0x${riv.accountAddress}`,
          displayAddress: address,
          isValid: true,
          encoding: EAddressEncodings.BECH32,
        };
      } catch (error) {
        // pass
      }
    } else {
      try {
        const normalizedAddress = address.startsWith('0x')
          ? address.toLowerCase()
          : `0x${address.toLowerCase()}`;
        const accountAddress = encoding.addressToSCS(normalizedAddress);
        // in order to check invalid address length, because the auto padding 0 at head of address
        if (encoding.addressFromSCS(accountAddress) === normalizedAddress) {
          return {
            normalizedAddress,
            displayAddress: normalizedAddress,
            isValid: true,
            encoding: EAddressEncodings.HEX,
          };
        }
      } catch (error) {
        // pass
      }
    }

    return {
      isValid: false,
      normalizedAddress: '',
      displayAddress: '',
    };
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
}
