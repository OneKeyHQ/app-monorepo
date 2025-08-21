/* eslint-disable spellcheck/spell-checker, @typescript-eslint/no-unused-vars */
import {
  AptosConfig,
  Aptos as AptosRpcClient,
  Deserializer,
  Ed25519PublicKey,
  MimeType,
  MultiAgentTransaction,
  RawTransaction,
  Serializer,
  SignedTransaction,
  SimpleTransaction,
  TransactionPayloadEntryFunction,
  TransactionPayloadScript,
  U64,
  generateSignedTransactionForSimulation,
  postAptosFullNode,
} from '@aptos-labs/ts-sdk';
import BigNumber from 'bignumber.js';
import { isEmpty, isNil } from 'lodash';

import {
  normalizePrivateKey,
  validatePrivateKey,
} from '@onekeyhq/core/src/chains/aptos/helper/privateUtils';
import { deserializeTransaction } from '@onekeyhq/core/src/chains/aptos/helper/transactionUtils';
import type { IEncodedTxAptos } from '@onekeyhq/core/src/chains/aptos/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import {
  decodeSensitiveTextAsync,
  encodeSensitiveTextAsync,
} from '@onekeyhq/core/src/secret';
import type {
  IEncodedTx,
  ISignedTxPro,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import {
  InvalidAccount,
  NetworkFeeInsufficient,
  OneKeyInternalError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
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
  APTOS_NATIVE_TRANSFER_FUNC_LEGACY,
  APTOS_TOKEN_REGISTER,
  APTOS_TRANSFER_FUNC,
  APTOS_TRANSFER_FUNGIBLE_FUNC,
  buildSignedTx,
  generateTransferCoin,
  generateUnsignedTransaction,
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
import type {
  AnyRawTransaction,
  PendingTransactionResponse,
} from '@aptos-labs/ts-sdk';

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
      throw new OneKeyLocalError('Invalid transferInfo.to params');
    }
    const transferInfo = transfersInfo[0];
    const { to, amount, tokenInfo } = transferInfo;

    if (!tokenInfo) {
      throw new OneKeyLocalError(
        'Invalid transferInfo.tokenInfo params, should not be empty',
      );
    }

    const { address: sender } = await this.getAccount();

    const amountValue = new BigNumber(amount)
      .shiftedBy(tokenInfo.decimals)
      .toFixed(0);

    const encodedTx: IEncodedTxAptos = {
      payload: generateTransferCoin(
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
    const { bcsTxn, disableEditTx } = encodedTx;
    if (!isNil(bcsTxn) && !isEmpty(bcsTxn)) {
      const originalTxn = deserializeTransaction(bcsTxn);
      const rawTx = originalTxn.rawTransaction;

      let expirationTimestampSecs = rawTx.expiration_timestamp_secs;
      if (!disableEditTx && rawTx.expiration_timestamp_secs < expect) {
        expirationTimestampSecs = expect;
      }

      const newRawTx = new RawTransaction(
        rawTx.sender,
        rawTx.sequence_number,
        rawTx.payload,
        rawTx.max_gas_amount,
        rawTx.gas_unit_price,
        expirationTimestampSecs,
        rawTx.chain_id,
      );

      let newTxn: AnyRawTransaction;
      if (originalTxn instanceof MultiAgentTransaction) {
        newTxn = new MultiAgentTransaction(
          newRawTx,
          originalTxn.secondarySignerAddresses,
          originalTxn.feePayerAddress,
        );
      } else if (originalTxn instanceof SimpleTransaction) {
        newTxn = new SimpleTransaction(newRawTx, originalTxn.feePayerAddress);
      } else {
        const _exhaustiveCheck: never = originalTxn;
        throw new OneKeyLocalError(
          `Unhandled transaction type: ${_exhaustiveCheck as string}`,
        );
      }

      const serializer = new Serializer();
      newTxn.serialize(serializer);
      encodedTx.bcsTxn = bufferUtils.bytesToHex(serializer.toUint8Array());
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

  private async _decodeTxByBcsTxn(bcsTxn: string, network: IServerNetwork) {
    const deserializer = new Deserializer(bufferUtils.hexToBytes(bcsTxn));
    const simpleTxn = SimpleTransaction.deserialize(deserializer);
    const rawTx = simpleTxn.rawTransaction;

    let actionType = EDecodedTxActionType.UNKNOWN;
    const payload = rawTx.payload;

    const { sender } = rawTx;
    const senderAddress = sender.bcsToHex().toString();
    const actions: IDecodedTxAction[] = [];

    switch (true) {
      case payload instanceof TransactionPayloadEntryFunction:
        // eslint-disable-next-line no-case-declarations
        const functionName = payload.entryFunction.function_name.identifier;
        // eslint-disable-next-line no-case-declarations
        const address = payload.entryFunction.module_name.address.toString();
        // eslint-disable-next-line no-case-declarations
        const moduleName = payload.entryFunction.module_name.name.identifier;

        // eslint-disable-next-line no-case-declarations
        const moveFunctionName = `${address}::${moduleName}::${functionName}`;

        if (
          moveFunctionName === APTOS_NATIVE_TRANSFER_FUNC ||
          moveFunctionName === APTOS_TRANSFER_FUNC ||
          moveFunctionName === APTOS_NATIVE_TRANSFER_FUNC_LEGACY
        ) {
          // https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-framework/doc/aptos_account.md#function-transfer
          // https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-framework/doc/aptos_account.md#function-transfer_coins
          // https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-framework/doc/coin.md#function-transfer
          actionType = EDecodedTxActionType.ASSET_TRANSFER;

          const [coinTypeTypeArg] = payload.entryFunction.type_args || [];
          const [toArg, amountValueArg] = payload.entryFunction.args || [];
          const toAddress = toArg.bcsToHex().toString();

          const amountValue = new BigNumber(
            U64.deserialize(
              new Deserializer(amountValueArg.bcsToBytes()),
            ).value.toString(),
          );
          const coinType = coinTypeTypeArg.toString();

          const tokenInfo = await this.backgroundApi.serviceToken.getToken({
            networkId: network.id,
            accountId: this.accountId,
            tokenIdOnNetwork: coinType.toString() ?? APTOS_NATIVE_COIN,
          });

          if (tokenInfo) {
            const amount = new BigNumber(amountValue)
              .shiftedBy(-tokenInfo.decimals)
              .toFixed();

            actions.push(
              await this.buildTxTransferAssetAction({
                from: senderAddress,
                to: toAddress,
                transfers: [
                  {
                    from: senderAddress,
                    to: toAddress,
                    amount,
                    icon: tokenInfo.logoURI ?? '',
                    name: tokenInfo.symbol,
                    symbol: tokenInfo.symbol,
                    tokenIdOnNetwork: coinType ?? APTOS_NATIVE_COIN,
                    isNative: !coinType || coinType === APTOS_NATIVE_COIN,
                  },
                ],
              }),
            );
          }
        } else if (moveFunctionName === APTOS_TRANSFER_FUNGIBLE_FUNC) {
          actionType = EDecodedTxActionType.ASSET_TRANSFER;
          const [tokenAddressArg, toArg, amountValueArg] =
            payload.entryFunction.args || [];
          const tokenAddress = tokenAddressArg.bcsToHex().toString();
          const toAddress = toArg.bcsToHex().toString();

          const amountValue = new BigNumber(
            U64.deserialize(
              new Deserializer(amountValueArg.bcsToBytes()),
            ).value.toString(),
          );

          const tokenInfo = await this.backgroundApi.serviceToken.getToken({
            networkId: network.id,
            accountId: this.accountId,
            tokenIdOnNetwork: tokenAddress,
          });

          if (tokenInfo) {
            const amount = new BigNumber(amountValue)
              .shiftedBy(-tokenInfo.decimals)
              .toFixed();

            actions.push(
              await this.buildTxTransferAssetAction({
                from: senderAddress,
                to: toAddress,
                transfers: [
                  {
                    from: senderAddress,
                    to: toAddress,
                    amount,
                    icon: tokenInfo.logoURI ?? '',
                    name: tokenInfo.symbol,
                    symbol: tokenInfo.symbol,
                    tokenIdOnNetwork: tokenAddress,
                    isNative: false,
                  },
                ],
              }),
            );
          }
        } else if (functionName === APTOS_TOKEN_REGISTER) {
          actionType = EDecodedTxActionType.TOKEN_ACTIVATE;

          const [coinTypeTypeArg] = payload.entryFunction.type_args || [];
          if (!coinTypeTypeArg) {
            break;
          }
          const coinType = coinTypeTypeArg.toString();
          const tokenInfo = await this.backgroundApi.serviceToken.getToken({
            networkId: network.id,
            accountId: this.accountId,
            tokenIdOnNetwork: coinType.toString(),
          });
          if (!tokenInfo) {
            break;
          }
          actions.push({
            type: EDecodedTxActionType.TOKEN_ACTIVATE,
            tokenActivate: {
              tokenIdOnNetwork: tokenInfo.address,
              icon: tokenInfo.logoURI ?? '',
              decimals: tokenInfo.decimals,
              name: tokenInfo.name,
              symbol: tokenInfo.symbol,
              from: '',
              to: '',
            },
          });
        } else {
          actions.push({
            type: EDecodedTxActionType.FUNCTION_CALL,
            direction: EDecodedTxDirection.OTHER,
            functionCall: {
              from: senderAddress,
              to: '',
              functionName: moveFunctionName,
              args:
                payload.entryFunction.args?.map((a) =>
                  a.bcsToHex().toString(),
                ) ?? [],
            },
          });
        }

        break;
      case payload instanceof TransactionPayloadScript:
        actionType = EDecodedTxActionType.FUNCTION_CALL;
        actions.push({
          type: EDecodedTxActionType.FUNCTION_CALL,
          direction: EDecodedTxDirection.OTHER,
          functionCall: {
            from: senderAddress,
            to: '',
            functionName: 'Script_Payload',
            args:
              payload.script.args?.map((a) => a.bcsToHex().toString()) ?? [],
          },
        });
        break;
      default:
        actionType = EDecodedTxActionType.UNKNOWN;
        break;
    }

    if (actions.length === 0) {
      actions.push({
        type: EDecodedTxActionType.UNKNOWN,
        direction: EDecodedTxDirection.OTHER,
        unknownAction: {
          from: senderAddress,
          to: '',
        },
      });
    }

    return {
      actionType,
      actions,
      rawTxn: rawTx,
    };
  }

  override async buildDecodedTx(
    params: IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const network = await this.getNetwork();
    const { unsignedTx } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxAptos;
    const { swapInfo, stakingInfo } = unsignedTx;
    const { payload } = encodedTx;
    const account = await this.getAccount();
    if (!encodedTx?.sender) {
      encodedTx.sender = account.address;
    }

    let gasLimit = encodedTx.max_gas_amount;
    let gasPrice = encodedTx.gas_unit_price;

    let action: IDecodedTxAction | null = null;

    if (swapInfo && !!payload) {
      // OneKey Client Swap
      const [toAddress] = payload.arguments || [];
      action = await this.buildInternalSwapAction({
        swapInfo,
        swapToAddress: toAddress,
      });
    } else if (stakingInfo && !!payload) {
      const [toAddress] = payload.arguments || [];
      const accountAddress = await this.getAccountAddress();
      action = await this.buildInternalStakingAction({
        accountAddress,
        stakingInfo,
        stakingToAddress: toAddress,
      });
    } else if (encodedTx.bcsTxn) {
      const { actions, rawTxn } = await this._decodeTxByBcsTxn(
        encodedTx.bcsTxn,
        network,
      );
      action = actions[0];
      gasLimit = rawTxn.max_gas_amount.toString();
      gasPrice = rawTxn.gas_unit_price.toString();
    } else if (payload) {
      const { type } = payload;
      const fun =
        payload.type === 'entry_function_payload'
          ? payload?.function
          : undefined;
      const actionType = getTransactionTypeByPayload({
        type: type ?? 'entry_function_payload',
        function_name: fun,
      });

      // fungible assets transfer
      if (fun === APTOS_TRANSFER_FUNGIBLE_FUNC) {
        const { sender } = encodedTx;
        const [tokenAddress, to, amountValue] = payload.arguments || [];

        const tokenInfo = await this.backgroundApi.serviceToken.getToken({
          networkId: network.id,
          accountId: this.accountId,
          tokenIdOnNetwork: tokenAddress,
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
                tokenIdOnNetwork: tokenAddress,
                isNative: false,
              },
            ],
          });
        }
      } else if (actionType === EDecodedTxActionType.ASSET_TRANSFER) {
        const { sender } = encodedTx;
        const [coinType] = payload?.type_arguments || [];
        const [to, amountValue] = payload?.arguments || [];
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
              payload?.arguments?.map((a) => {
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
          gasPrice: gasPrice ?? '1',
          gasLimit: gasLimit ?? '0',
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

    let {
      bcsTxn,
      disableEditTx,
      max_gas_amount: maxGasAmount,
    } = params.encodedTx;
    // Standard wallet dApp interface not edit fee
    if (!disableEditTx && !isNil(bcsTxn) && !isEmpty(bcsTxn)) {
      const deserializer = new Deserializer(bufferUtils.hexToBytes(bcsTxn));
      const simpleTxn = SimpleTransaction.deserialize(deserializer);
      const rawTx = simpleTxn.rawTransaction;

      const newMaxGasAmount =
        rawTx.max_gas_amount < BigInt(maxGasAmount ?? '0')
          ? BigInt(maxGasAmount ?? '0')
          : rawTx.max_gas_amount;

      const newRawTx = new RawTransaction(
        rawTx.sender,
        rawTx.sequence_number,
        rawTx.payload,
        newMaxGasAmount,
        BigInt(gasPrice),
        rawTx.expiration_timestamp_secs,
        rawTx.chain_id,
      );
      const serializer = new Serializer();
      const newSimpleTxn = new SimpleTransaction(
        newRawTx,
        simpleTxn.feePayerAddress,
      );
      newSimpleTxn.serialize(serializer);
      bcsTxn = bufferUtils.bytesToHex(serializer.toUint8Array());
    }

    const encodedTxWithFee = {
      ...params.encodedTx,
      gas_unit_price: gasPrice,
      max_gas_amount: gas.gasLimit,
      bcsTxn,
    };
    return Promise.resolve(encodedTxWithFee);
  }

  private _updateExpirationTimestampSecs(encodedTx: IEncodedTxAptos) {
    const expirationTimestampSecs = getExpirationTimestampSecs();
    const { bcsTxn, disableEditTx } = encodedTx;
    if (!disableEditTx && !isNil(bcsTxn) && !isEmpty(bcsTxn)) {
      const deserializer = new Deserializer(bufferUtils.hexToBytes(bcsTxn));
      const simpleTxn = SimpleTransaction.deserialize(deserializer);
      const rawTx = simpleTxn.rawTransaction;
      const newRawTx = new RawTransaction(
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
      const serializer = new Serializer();
      const newSimpleTxn = new SimpleTransaction(
        newRawTx,
        simpleTxn.feePayerAddress,
      );
      newSimpleTxn.serialize(serializer);
      encodedTx.bcsTxn = bufferUtils.bytesToHex(serializer.toUint8Array());
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
    const { payload } = encodedTx;
    if (
      nativeAmountInfo &&
      payload?.type === 'entry_function_payload' &&
      [
        APTOS_NATIVE_TRANSFER_FUNC,
        APTOS_TRANSFER_FUNC,
        APTOS_NATIVE_TRANSFER_FUNC_LEGACY,
      ].includes(payload?.function ?? '') &&
      unsignedTx.transfersInfo
    ) {
      const decimals = unsignedTx.transfersInfo[0].tokenInfo?.decimals ?? 0;
      const amount = new BigNumber(nativeAmountInfo.maxSendAmount ?? '0')
        .shiftedBy(decimals)
        .toFixed(0, BigNumber.ROUND_FLOOR);

      const [to] = payload.arguments || [];
      payload.arguments = [to, amount];
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

  override async getPrivateKeyFromImported(
    params: IGetPrivateKeyFromImportedParams,
  ): Promise<IGetPrivateKeyFromImportedResult> {
    const input = await decodeSensitiveTextAsync({
      encodedText: params.input,
    });
    const privateKey = normalizePrivateKey(input, 'legacy');
    return {
      privateKey: await encodeSensitiveTextAsync({ text: privateKey }),
    };
  }

  override validateXprvt(xprvt: string): Promise<IXprvtValidation> {
    return Promise.resolve({
      isValid: false,
    });
  }

  override validatePrivateKey(
    privateKey: string,
  ): Promise<IPrivateKeyValidation> {
    return Promise.resolve({
      isValid: validatePrivateKey(privateKey),
    });
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
    encodedTx: IEncodedTxAptos | undefined;
  }) {
    if (!encodedTx) {
      return { encodedTx };
    }

    let rawTx: AnyRawTransaction;
    const unSignedEncodedTx = encodedTx;
    const { bcsTxn } = unSignedEncodedTx;
    if (bcsTxn && !isEmpty(bcsTxn)) {
      rawTx = deserializeTransaction(bcsTxn);
    } else {
      try {
        rawTx = await generateUnsignedTransaction(this.client, {
          encodedTx,
        });
      } catch (error) {
        if (error instanceof InvalidAccount) {
          throw new InvalidAccount({
            message: error.message,
          });
        }

        throw error;
      }
    }

    const account = await this.getAccount();
    let pubkey = account.pub;
    if (!pubkey) {
      const accountOnChain = await this.client.getAccount(account.address);
      pubkey = accountOnChain.authentication_key;
    }

    const rawTxn = rawTx.rawTransaction;
    const newRawTx = new RawTransaction(
      rawTxn.sender,
      rawTxn.sequence_number,
      rawTxn.payload,
      BigInt('200000'),
      BigInt('0'),
      rawTxn.expiration_timestamp_secs || getExpirationTimestampSecs(),
      rawTxn.chain_id,
    );

    if (rawTx instanceof MultiAgentTransaction) {
      rawTx = new MultiAgentTransaction(
        newRawTx,
        rawTx.secondarySignerAddresses,
        rawTx.feePayerAddress,
      );
    } else if (rawTx instanceof SimpleTransaction) {
      rawTx = new SimpleTransaction(newRawTx, rawTx.feePayerAddress);
    } else {
      const _exhaustiveCheck: never = rawTx;
      throw new OneKeyLocalError(
        `Unhandled transaction type: ${_exhaustiveCheck as string}`,
      );
    }

    const rawSignTxBytes = generateSignedTransactionForSimulation({
      transaction: rawTx,
      signerPublicKey: new Ed25519PublicKey(
        bufferUtils.hexToBytes(hexUtils.stripHexPrefix(pubkey)),
      ),
      feePayerPublicKey: rawTx.feePayerAddress
        ? new Ed25519PublicKey(
            bufferUtils.hexToBytes(hexUtils.stripHexPrefix(pubkey)),
          )
        : undefined,
      secondarySignersPublicKeys: rawTx.secondarySignerAddresses
        ? rawTx.secondarySignerAddresses.map(
            () =>
              new Ed25519PublicKey(
                bufferUtils.hexToBytes(hexUtils.stripHexPrefix(pubkey)),
              ),
          )
        : undefined,
    });

    const params = {
      encodedTx: {
        ...encodedTx,
        ...encodedTx.payload,
        rawSignTx: bufferUtils.bytesToHex(rawSignTxBytes),
      },
    };

    delete params.encodedTx.payload;

    return params;
  }

  override async attachFeeInfoToDAppEncodedTx(params: {
    encodedTx: IEncodedTx;
    feeInfo: IFeeInfoUnit;
  }): Promise<IEncodedTx> {
    // Standard wallet dApp interface not edit fee
    const unSignedEncodedTx = params.encodedTx as IEncodedTxAptos;
    if (unSignedEncodedTx.disableEditTx && unSignedEncodedTx.bcsTxn) {
      return Promise.resolve('');
    }
    return unSignedEncodedTx;
  }

  override async getCustomRpcEndpointStatus(
    params: IMeasureRpcStatusParams,
  ): Promise<IMeasureRpcStatusResult> {
    const config = new AptosConfig({ fullnode: params.rpcUrl });
    const client = new AptosRpcClient(config);

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

    const rpcUrlWithoutSeparator = rpcUrl.replace(/\/$/, '');
    const hasVersion = /\/v\d+$/.test(rpcUrlWithoutSeparator);
    const rpcUrlFull = hasVersion
      ? rpcUrlWithoutSeparator
      : `${rpcUrlWithoutSeparator}/v1`;

    const config = new AptosConfig({ fullnode: rpcUrlFull });
    const deserializer = new Deserializer(
      bufferUtils.hexToBytes(signedTx.rawTx),
    );
    const signedTransactionBscHex = SignedTransaction.deserialize(deserializer)
      .bcsToHex()
      .toUint8Array();
    const { data } = await postAptosFullNode<
      Uint8Array,
      PendingTransactionResponse
    >({
      aptosConfig: config,
      body: signedTransactionBscHex,
      path: 'transactions',
      originMethod: 'submitTransaction',
      contentType: MimeType.BCS_SIGNED_TRANSACTION,
    });
    return {
      ...params.signedTx,
      txid: data.hash,
    };
  }
}
