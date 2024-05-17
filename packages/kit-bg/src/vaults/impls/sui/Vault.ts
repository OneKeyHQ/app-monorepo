/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  SUI_TYPE_ARG,
  TransactionBlock,
  builder,
  isValidSuiAddress,
} from '@mysten/sui.js';
import BigNumber from 'bignumber.js';
import { get, isEmpty } from 'lodash';

import type { IEncodedTxSui } from '@onekeyhq/core/src/chains/sui/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  IEncodedTx,
  ISignedTxPro,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import chainValueUtils from '@onekeyhq/shared/src/utils/chainValueUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
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
import { OneKeySuiClient } from './sdkSui/ClientSui';
import { createCoinSendTransaction } from './sdkSui/coin-helper';
import { SuiJsonRpcClient } from './sdkSui/SuiJsonRpcClient';
import { normalizeSuiCoinType } from './sdkSui/utils';

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
} from '../../types';
import type {
  SuiGasData,
  TransactionBlockInput,
  TransferObjectsTransaction,
} from '@mysten/sui.js';

export default class Vault extends VaultBase {
  override coreApi = coreChainApi.sui.hd;

  override keyringMap: Record<IDBWalletType, typeof KeyringBase> = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringExternal,
  };

  getClientCache = memoizee(async () => this.getSuiClient(), {
    promise: true,
    max: 1,
    maxAge: timerUtils.getTimeDurationMs({ minute: 3 }),
  });

  async getClient() {
    return this.getClientCache();
  }

  getSuiClient() {
    const rpcClient = new SuiJsonRpcClient({
      backgroundApi: this.backgroundApi,
      networkId: this.networkId,
    });
    return new OneKeySuiClient(undefined, {
      rpcClient,
    });
  }

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
  ): Promise<IEncodedTxSui> {
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
    const { to, amount, tokenInfo } = transferInfo;
    const account = await this.getAccount();
    const recipient = hexUtils.addHexPrefix(to);
    const sender = hexUtils.addHexPrefix(account.address);
    if (!tokenInfo?.decimals) {
      throw new OneKeyInternalError('Token decimals is required');
    }
    const amountValue = new BigNumber(amount)
      .shiftedBy(tokenInfo.decimals)
      .toFixed();
    const client = await this.getClient();
    const transaction = await createCoinSendTransaction({
      client,
      address: sender,
      to: recipient,
      amount: amountValue,
      coinType: normalizeSuiCoinType(tokenInfo.address),
    });

    return {
      rawTx: transaction.serialize(),
    };
  }

  override async buildDecodedTx(
    params: IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const { unsignedTx } = params;
    const encodedTx = unsignedTx?.encodedTx as IEncodedTxSui;
    const transactionBlock = TransactionBlock.from(encodedTx.rawTx);
    if (!transactionBlock) {
      throw new OneKeyInternalError('Failed to decode transaction');
    }

    const network = await this.getNetwork();
    const account = await this.getAccount();
    const { inputs, transactions, gasConfig } = transactionBlock.blockData;
    let gasLimit = '0';
    if (gasConfig.budget) {
      gasLimit = gasConfig.budget.toString() ?? '0';
    }

    const actions: IDecodedTxAction[] = [];
    try {
      for (const transaction of transactions) {
        switch (transaction.kind) {
          case 'TransferObjects': {
            const action = await this._buildTxActionFromTransferObjects({
              transaction,
              transactions,
              inputs,
              payments: gasConfig.payment,
            });
            actions.push(action);
            break;
          }
          case 'MoveCall': {
            console.log('MoveCall', transaction);
            break;
          }
          case 'MakeMoveVec':
          case 'SplitCoins':
          case 'MergeCoins':
            break;
          default:
            actions.push({
              type: EDecodedTxActionType.UNKNOWN,
              direction: EDecodedTxDirection.OTHER,
              unknownAction: {
                from: account.address,
                to: '',
                icon: network.logoURI ?? '',
              },
            });
            break;
        }
      }
    } catch {
      // ignore parse error
    }

    const result: IDecodedTx = {
      txid: '',
      owner: account.address,
      signer: account.address,
      nonce: 0,
      actions,
      status: EDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      // feeInfo: {
      //   price: chainValueUtils.convertChainValueToGwei({
      //     value: '1',
      //     network,
      //   }),
      //   limit: gasLimit,
      // },
      payload: {
        type: EOnChainHistoryTxType.Send,
      },
      extraInfo: null,
      encodedTx,
    };

    return Promise.resolve(result);
  }

  async _buildTxActionFromTransferObjects({
    transaction,
    transactions,
    inputs,
    payments,
  }: // tokenInfo,
  {
    transaction: TransferObjectsTransaction;
    transactions: TransactionBlock['blockData']['transactions'];
    inputs: TransactionBlockInput[];
    // tokenInfo: V
    payments?: SuiGasData['payment'] | undefined;
  }): Promise<IDecodedTxAction> {
    if (transaction.kind !== 'TransferObjects') {
      throw new Error('Invalid transaction kind');
    }

    const client = await this.getClient();
    let amount = new BigNumber('0');
    let coinType = SUI_TYPE_ARG;
    for (const obj of transaction.objects) {
      if (obj.kind === 'GasCoin' && payments) {
        // payment all
        coinType = SUI_TYPE_ARG;

        const objectIds = payments?.reduce((acc, current) => {
          if (current.objectId) {
            acc.push(current.objectId);
          }
          return acc;
        }, new Array<string>(inputs.length));

        const objects = await client.multiGetObjects({
          ids: objectIds,
          options: {
            showType: true,
            showOwner: true,
            showContent: true,
          },
        });

        amount = objects.reduce((acc, current) => {
          let temp = acc;
          const content = current.data?.content;
          if (content?.dataType === 'moveObject') {
            const balance = content.fields?.balance;
            temp = temp.plus(new BigNumber(balance));
          }
          return temp;
        }, new BigNumber(0));
      } else if (obj.kind === 'Result') {
        const result = transactions[obj.index];
        if (result.kind === 'SplitCoins' && result.coin.kind === 'Input') {
          const object = await client.getObject({
            id: result.coin.value,
            options: {
              showType: true,
              showOwner: true,
              showContent: true,
            },
          });

          const regex = /<([^>]+)>/;
          const match = object.data?.type?.match(regex);

          if (match) {
            const extracted = match[1];
            if (object.data?.type?.startsWith('0x2::coin::Coin<')) {
              coinType = extracted;
            }
          }

          amount = result.amounts.reduce((acc, current) => {
            let newAmount = acc;
            if (current.kind === 'Input') {
              newAmount = newAmount.plus(new BigNumber(current.value));
            }
            return newAmount;
          }, new BigNumber(0));
          break;
        }
      } else if (obj.kind === 'Input') {
        const inputResult = inputs[obj.index];
        if (inputResult.type === 'pure') {
          amount = new BigNumber(inputResult.value);
          break;
        }
        if (inputResult.type === 'object') {
          // NFT
        }
      } else if (obj.kind === 'NestedResult') {
        const inputResult = inputs[obj.index];
        amount.plus(new BigNumber(inputResult.value ?? '0'));
      }
    }

    let to = '';
    if (transaction.address.kind === 'Input') {
      const argValue = get(transaction.address.value, 'Pure', undefined);
      if (argValue) {
        try {
          to = builder.de('vector<u8>', argValue);
        } catch (e) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            to = argValue.toString();
          } catch (error) {
            // ignore
          }
        }
      } else {
        to = transaction.address.value;
      }
    }

    const isNative = coinType === SUI_TYPE_ARG;
    const { address: sender } = await this.getAccount();
    const token = await this.backgroundApi.serviceToken.getToken({
      networkId: this.networkId,
      tokenIdOnNetwork: coinType,
      accountAddress: sender,
    });
    return {
      type: EDecodedTxActionType.ASSET_TRANSFER,
      assetTransfer: {
        from: sender,
        to,
        sends: [
          {
            from: sender,
            to,
            amount: amount.shiftedBy(-token.decimals).toFixed(),
            icon: token.logoURI ?? '',
            name: token.name,
            symbol: token.symbol,
            tokenIdOnNetwork: coinType,
            isNative,
          },
        ],
        receives: [],
      },
    };
  }

  override async buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const encodedTx = params.encodedTx ?? (await this.buildEncodedTx(params));
    if (encodedTx) {
      return {
        encodedTx,
        transfersInfo: params.transfersInfo,
      };
    }
    throw new OneKeyInternalError();
  }

  override async updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    return Promise.resolve(params.unsignedTx);
  }

  override broadcastTransaction(
    params: IBroadcastTransactionParams,
  ): Promise<ISignedTxPro> {
    throw new Error('Method not implemented.');
  }

  override validateAddress(address: string): Promise<IAddressValidation> {
    const isValid = isValidSuiAddress(address);
    return Promise.resolve({
      isValid,
      normalizedAddress: isValid ? address : '',
      displayAddress: isValid ? address : '',
    });
  }

  override validateXpub(xpub: string): Promise<IXpubValidation> {
    return Promise.resolve({
      isValid: false,
    });
  }

  override async getPrivateKeyFromImported(
    params: IGetPrivateKeyFromImportedParams,
  ): Promise<IGetPrivateKeyFromImportedResult> {
    return super.baseGetPrivateKeyFromImported(params);
  }

  override validateXprvt(xprvt: string): Promise<IXprvtValidation> {
    return Promise.resolve({
      isValid: false,
    });
  }

  override async validatePrivateKey(
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
