/* eslint-disable @typescript-eslint/no-unused-vars */
import { BCS, TxnBuilderTypes } from 'aptos';
import BigNumber from 'bignumber.js';
import { isEmpty, isNil } from 'lodash';

import type { IEncodedTxAptos } from '@onekeyhq/core/src/chains/aptos/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  IEncodedTx,
  ISignedTxPro,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
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
  EDecodedTxDirection,
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
import { AptosClient } from './sdkAptos/AptosClient';
import {
  APTOS_NATIVE_COIN,
  generateTransferCoin,
  getTransactionTypeByPayload,
} from './utils';

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
  IValidateGeneralInputParams,
  IVaultSettings,
} from '../../types';

export default class VaultAptos extends VaultBase {
  override coreApi = coreChainApi.aptos.hd;

  override keyringMap: Record<IDBWalletType, typeof KeyringBase> = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringExternal,
  };

  client = new AptosClient({
    backgroundApi: this.backgroundApi,
    networkId: this.networkId,
  });

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
    if (!transfersInfo || transfersInfo.length === 0 || !transfersInfo[0].to) {
      throw new Error('Invalid transferInfo.to params');
    }
    const transferInfo = transfersInfo[0];
    const { to, amount, tokenInfo } = transferInfo;

    if (!tokenInfo) {
      throw new Error(
        'Invalid transferInfo.tokenInfo params, should not be empty',
      );
    }

    const { address: sender } = await this.getAccount();

    const amountValue = new BigNumber(amount)
      .shiftedBy(tokenInfo.decimals)
      .toFixed();

    const encodedTx: IEncodedTxAptos = {
      ...generateTransferCoin(
        to,
        amountValue,
        tokenInfo.isNative ? '' : tokenInfo.address,
      ),
      sender,
    };

    return encodedTx;
  }

  private async _buildUnsignedTxFromEncodedTx(
    encodedTx: IEncodedTxAptos,
  ): Promise<IUnsignedTxPro> {
    const expect = BigInt(Math.floor(Date.now() / 1000) + 100);
    if (!isNil(encodedTx.bscTxn) && !isEmpty(encodedTx.bscTxn)) {
      const deserializer = new BCS.Deserializer(
        bufferUtils.hexToBytes(encodedTx.bscTxn),
      );
      const rawTx = TxnBuilderTypes.RawTransaction.deserialize(deserializer);
      const newRawTx = new TxnBuilderTypes.RawTransaction(
        rawTx.sender,
        rawTx.sequence_number,
        rawTx.payload,
        rawTx.max_gas_amount,
        rawTx.gas_unit_price,
        rawTx.expiration_timestamp_secs > expect
          ? rawTx.expiration_timestamp_secs
          : expect,
        rawTx.chain_id,
      );

      const serializer = new BCS.Serializer();
      newRawTx.serialize(serializer);
      encodedTx.bscTxn = bufferUtils.bytesToHex(serializer.getBytes());
    } else if (
      encodedTx.expiration_timestamp_secs &&
      BigInt(encodedTx.expiration_timestamp_secs) < expect
    ) {
      encodedTx.expiration_timestamp_secs = expect.toString();
    }

    return {
      encodedTx,
    };
  }

  override async buildDecodedTx(
    params: IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const network = await this.getNetwork();
    const { unsignedTx } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxAptos;
    const { type, function: fun } = encodedTx;
    const account = await this.getAccount();
    if (!encodedTx?.sender) {
      encodedTx.sender = account.address;
    }
    let action: IDecodedTxAction | null = null;
    const actionType = getTransactionTypeByPayload({
      type: type ?? 'entry_function_payload',
      function_name: fun,
    });

    if (actionType === EDecodedTxActionType.ASSET_TRANSFER) {
      const { sender } = encodedTx;
      const [coinType] = encodedTx.type_arguments || [];
      const [to, amountValue] = encodedTx.arguments || [];
      const tokenInfo = await this.backgroundApi.serviceToken.getToken({
        networkId: network.id,
        tokenIdOnNetwork: coinType ?? APTOS_NATIVE_COIN,
        accountAddress: account.address,
      });
      const amount = new BigNumber(amountValue)
        .shiftedBy(-tokenInfo.decimals)
        .toFixed();

      const transferAction = {
        tokenInfo,
        from: sender ?? '',
        to,
        amount,
        amountValue,
        extraInfo: null,
        sends: [
          {
            from: sender ?? '',
            to,
            amount,
            icon: tokenInfo.logoURI ?? '',
            name: tokenInfo.symbol,
            symbol: tokenInfo.symbol,
            tokenIdOnNetwork: coinType ?? APTOS_NATIVE_COIN,
          },
        ],
        receives: [],
      };

      action = {
        type: actionType,
        assetTransfer: transferAction,
      };
    } else if (actionType === EDecodedTxActionType.FUNCTION_CALL) {
      action = {
        type: EDecodedTxActionType.FUNCTION_CALL,
        direction: EDecodedTxDirection.OTHER,
        functionCall: {
          from: encodedTx.sender,
          to: '',
          functionName: fun ?? '',
          args:
            encodedTx.arguments?.map((a) => {
              if (
                typeof a === 'string' ||
                typeof a === 'number' ||
                typeof a === 'boolean' ||
                typeof a === 'bigint'
              ) {
                return a.toString();
              }
              if (a instanceof Array) {
                try {
                  return bufferUtils.bytesToHex(a as unknown as Uint8Array);
                } catch (e) {
                  return JSON.stringify(a);
                }
              }
              return '';
            }) ?? [],
        },
      };
    } else {
      action = {
        type: EDecodedTxActionType.UNKNOWN,
        direction: EDecodedTxDirection.OTHER,
        unknownAction: {
          from: encodedTx.sender,
          to: '',
        },
      };
    }

    const result: IDecodedTx = {
      txid: '',
      owner: account.address,
      signer: account.address,
      nonce: 0,
      actions: [action],
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
          gasPrice: encodedTx.gas_unit_price ?? '1',
          gasLimit: encodedTx.max_gas_amount ?? '0',
        },
      },
      extraInfo: null,
      encodedTx,
    };

    return Promise.resolve(result);
  }

  override async buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const encodedTx = params.encodedTx ?? (await this.buildEncodedTx(params));
    if (encodedTx) {
      return this._buildUnsignedTxFromEncodedTx(encodedTx as IEncodedTxAptos);
    }
    throw new OneKeyInternalError();
  }

  private async _attachFeeInfoToEncodedTx(params: {
    encodedTx: IEncodedTxAptos;
    feeInfo: IFeeInfoUnit;
  }): Promise<IEncodedTxAptos> {
    const { gas, common } = params.feeInfo;
    if (typeof gas?.gasPrice !== 'string') {
      throw new OneKeyInternalError('Invalid gas price.');
    }
    if (typeof gas.gasLimit !== 'string') {
      throw new OneKeyInternalError('Invalid fee limit');
    }
    const gasPrice = new BigNumber(gas.gasPrice)
      .shiftedBy(common.feeDecimals)
      .toFixed();

    let { bscTxn } = params.encodedTx;
    if (!isNil(bscTxn) && !isEmpty(bscTxn)) {
      const deserializer = new BCS.Deserializer(bufferUtils.hexToBytes(bscTxn));
      const rawTx = TxnBuilderTypes.RawTransaction.deserialize(deserializer);
      const newRawTx = new TxnBuilderTypes.RawTransaction(
        rawTx.sender,
        rawTx.sequence_number,
        rawTx.payload,
        BigInt(gas.gasLimit),
        BigInt(gasPrice),
        rawTx.expiration_timestamp_secs,
        rawTx.chain_id,
      );

      const serializer = new BCS.Serializer();
      newRawTx.serialize(serializer);
      bscTxn = bufferUtils.bytesToHex(serializer.getBytes());
    }

    const encodedTxWithFee = {
      ...params.encodedTx,
      gas_unit_price: gasPrice,
      max_gas_amount: gas.gasLimit,
      bscTxn,
    };
    return Promise.resolve(encodedTxWithFee);
  }

  override async updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const { unsignedTx, feeInfo } = params;
    let encodedTx = unsignedTx.encodedTx as IEncodedTxAptos;
    if (feeInfo) {
      encodedTx = await this._attachFeeInfoToEncodedTx({
        encodedTx,
        feeInfo,
      });
    }
    return {
      ...unsignedTx,
      encodedTx,
    };
  }

  override async validateAddress(address: string): Promise<IAddressValidation> {
    const isValid =
      hexUtils.isHexString(address) &&
      hexUtils.stripHexPrefix(address).length === 64;
    return {
      isValid,
      normalizedAddress: address,
      displayAddress: address,
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
    return this.baseGetPrivateKeyFromImported(params);
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
