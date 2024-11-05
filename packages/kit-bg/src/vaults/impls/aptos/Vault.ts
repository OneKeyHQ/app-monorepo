/* eslint-disable @typescript-eslint/no-unused-vars */
import { AptosClient as AptosRpcClient, BCS, TxnBuilderTypes } from 'aptos';
import BigNumber from 'bignumber.js';
import { isEmpty, isNil } from 'lodash';

import type { IEncodedTxAptos } from '@onekeyhq/core/src/chains/aptos/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  IEncodedTx,
  ISignedTxPro,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import {
  InvalidAccount,
  ManageTokenInsufficientBalanceError,
  OneKeyInternalError,
} from '@onekeyhq/shared/src/errors';
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
import type {
  IMeasureRpcStatusParams,
  IMeasureRpcStatusResult,
} from '@onekeyhq/shared/types/customRpc';
import type { IFeeInfoUnit } from '@onekeyhq/shared/types/fee';
import type { IAccountToken } from '@onekeyhq/shared/types/token';
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
  APTOS_NATIVE_TRANSFER_FUNC,
  APTOS_TRANSFER_FUNC,
  buildSignedTx,
  generateRegisterToken,
  generateTransferCoin,
  generateUnsignedTransaction,
  getAccountCoinResource,
  getExpirationTimestampSecs,
  getTransactionTypeByPayload,
} from './utils';

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

export default class VaultAptos extends VaultBase {
  override coreApi = coreChainApi.aptos.hd;

  override keyringMap: Record<IDBWalletType, typeof KeyringBase | undefined> = {
    hd: KeyringHd,
    qr: undefined,
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
      .toFixed(0);

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
    const expect = getExpirationTimestampSecs();
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
      !encodedTx.expiration_timestamp_secs ||
      BigInt(encodedTx.expiration_timestamp_secs) < expect
    ) {
      encodedTx.expiration_timestamp_secs = expect.toString();
    }

    if (!encodedTx.sender) {
      encodedTx.sender = (await this.getAccount()).address;
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
    const { swapInfo, stakingInfo } = unsignedTx;
    const { type, function: fun } = encodedTx;
    const account = await this.getAccount();
    if (!encodedTx?.sender) {
      encodedTx.sender = account.address;
    }
    let action: IDecodedTxAction | null = null;
    const [toAddress] = encodedTx.arguments || [];

    if (swapInfo) {
      action = await this.buildInternalSwapAction({
        swapInfo,
        swapToAddress: toAddress,
      });
    } else if (stakingInfo) {
      const accountAddress = await this.getAccountAddress();
      action = await this.buildInternalStakingAction({
        accountAddress,
        stakingInfo,
        stakingToAddress: toAddress,
      });
    } else {
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
          accountId: this.accountId,
          tokenIdOnNetwork: coinType ?? APTOS_NATIVE_COIN,
        });
        if (tokenInfo) {
          const amount = new BigNumber(amountValue)
            .shiftedBy(-tokenInfo.decimals)
            .toFixed();

          action = await this.buildTxTransferAssetAction({
            from: sender,
            to,
            transfers: [
              {
                from: sender,
                to,
                amount,
                icon: tokenInfo.logoURI ?? '',
                name: tokenInfo.symbol,
                symbol: tokenInfo.symbol,
                tokenIdOnNetwork: coinType ?? APTOS_NATIVE_COIN,
                isNative: !coinType || coinType === APTOS_NATIVE_COIN,
              },
            ],
          });
        }
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
                if (!a) {
                  return '';
                }
                return JSON.stringify(a);
              }) ?? [],
          },
        };
      }
    }

    if (!action) {
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
      const result = await this._buildUnsignedTxFromEncodedTx(
        encodedTx as IEncodedTxAptos,
      );
      return {
        ...result,
        transfersInfo: params.transfersInfo,
      };
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

  private _updateExpirationTimestampSecs(encodedTx: IEncodedTxAptos) {
    const expirationTimestampSecs = getExpirationTimestampSecs();
    const { bscTxn } = encodedTx;
    if (!isNil(bscTxn) && !isEmpty(bscTxn)) {
      const deserializer = new BCS.Deserializer(bufferUtils.hexToBytes(bscTxn));
      const rawTx = TxnBuilderTypes.RawTransaction.deserialize(deserializer);
      const newRawTx = new TxnBuilderTypes.RawTransaction(
        rawTx.sender,
        rawTx.sequence_number,
        rawTx.payload,
        rawTx.max_gas_amount,
        rawTx.gas_unit_price,
        rawTx.expiration_timestamp_secs > expirationTimestampSecs
          ? rawTx.expiration_timestamp_secs
          : expirationTimestampSecs,
        rawTx.chain_id,
      );

      const serializer = new BCS.Serializer();
      newRawTx.serialize(serializer);
      encodedTx.bscTxn = bufferUtils.bytesToHex(serializer.getBytes());
    } else {
      encodedTx.expiration_timestamp_secs = expirationTimestampSecs.toString();
    }
  }

  override async updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const { unsignedTx, feeInfo, nativeAmountInfo } = params;
    let encodedTx = unsignedTx.encodedTx as IEncodedTxAptos;
    if (feeInfo) {
      encodedTx = await this._attachFeeInfoToEncodedTx({
        encodedTx,
        feeInfo,
      });
    }
    // max native token transfer update
    if (
      nativeAmountInfo &&
      [APTOS_NATIVE_TRANSFER_FUNC, APTOS_TRANSFER_FUNC].includes(
        encodedTx?.function ?? '',
      ) &&
      unsignedTx.transfersInfo
    ) {
      const decimals = unsignedTx.transfersInfo[0].tokenInfo?.decimals ?? 0;
      const amount = new BigNumber(nativeAmountInfo.maxSendAmount ?? '0')
        .shiftedBy(decimals)
        .toFixed(0, BigNumber.ROUND_FLOOR);

      const [to] = encodedTx.arguments || [];
      encodedTx.arguments = [to, amount];
    }

    this._updateExpirationTimestampSecs(encodedTx);

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

  async getTransactionByHash(txId: string) {
    return this.client.getTransactionByHash(txId);
  }

  override async buildEstimateFeeParams({
    encodedTx,
  }: {
    encodedTx: IEncodedTx | undefined;
  }) {
    if (!encodedTx) {
      return { encodedTx };
    }

    let rawTx: TxnBuilderTypes.RawTransaction;
    const unSignedEncodedTx = encodedTx as IEncodedTxAptos;
    if (unSignedEncodedTx.bscTxn && unSignedEncodedTx.bscTxn?.length > 0) {
      const deserializer = new BCS.Deserializer(
        bufferUtils.hexToBytes(unSignedEncodedTx.bscTxn),
      );
      rawTx = TxnBuilderTypes.RawTransaction.deserialize(deserializer);
    } else {
      rawTx = await generateUnsignedTransaction(this.client, {
        encodedTx,
      });
    }

    const newRawTx = new TxnBuilderTypes.RawTransaction(
      rawTx.sender,
      rawTx.sequence_number,
      rawTx.payload,
      BigInt('200000'),
      BigInt('0'),
      rawTx.expiration_timestamp_secs || getExpirationTimestampSecs(),
      rawTx.chain_id,
    );

    const account = await this.getAccount();
    const invalidSigBytes = new Uint8Array(64);
    let pubkey = account.pub;
    if (!pubkey) {
      const accountOnChain = await this.client.getAccount(account.address);
      pubkey = accountOnChain.authentication_key;
    }
    const { rawTx: rawSignTx } = await buildSignedTx(
      newRawTx,
      pubkey,
      bufferUtils.bytesToHex(invalidSigBytes),
    );

    return {
      encodedTx: {
        ...(encodedTx as object),
        rawSignTx,
      } as unknown as IEncodedTx,
    };
  }

  override async activateToken(params: {
    token: IAccountToken;
  }): Promise<boolean> {
    const { token } = params;
    if (token.address === APTOS_NATIVE_COIN) {
      return true;
    }
    const account = await this.getAccount();
    let coin;
    try {
      coin = await getAccountCoinResource(
        this.client,
        account.address,
        token.address,
      );
    } catch (e) {
      if (e instanceof InvalidAccount) {
        throw new ManageTokenInsufficientBalanceError({
          info: {
            token: 'APT',
          },
        });
      }
    }
    if (coin) {
      return true;
    }
    const unsignedTx = await this.buildUnsignedTx({
      encodedTx: generateRegisterToken(token.address),
    });
    const [signedTx] =
      await this.backgroundApi.serviceSend.batchSignAndSendTransaction({
        accountId: this.accountId,
        networkId: this.networkId,
        unsignedTxs: [unsignedTx],
        transferPayload: undefined,
      });
    return !!signedTx.signedTx.txid;
  }

  override async getCustomRpcEndpointStatus(
    params: IMeasureRpcStatusParams,
  ): Promise<IMeasureRpcStatusResult> {
    const client = new AptosRpcClient(params.rpcUrl);
    const start = performance.now();
    const { block_height: blockNumber } = await client.getLedgerInfo();
    const bestBlockNumber = parseInt(blockNumber, 10);
    return {
      responseTime: Math.floor(performance.now() - start),
      bestBlockNumber,
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
    const client = new AptosRpcClient(rpcUrl);
    const { hash: txId } = await client.submitSignedBCSTransaction(
      bufferUtils.hexToBytes(signedTx.rawTx),
    );
    console.log('broadcastTransaction END:', {
      txid: txId,
      rawTx: signedTx.rawTx,
    });
    return {
      ...params.signedTx,
      txid: txId,
    };
  }
}
