import BigNumber from 'bignumber.js';

import { IDecodedTxActionType } from '../../../types';
import { SUI_NATIVE_COIN } from '../utils';

import type {
  JsonRpcProvider,
  SuiGasData,
  TransactionBlock,
  TransactionBlockInput,
  TransferObjectsTransaction,
} from '@mysten/sui.js';

export async function decodeActionWithTransferObjects(
  client: JsonRpcProvider,
  transaction: TransferObjectsTransaction,
  transactions: TransactionBlock['blockData']['transactions'],
  inputs: TransactionBlockInput[],
  payments?: SuiGasData['payment'] | undefined, // Payment
) {
  if (transaction.kind !== 'TransferObjects') {
    throw new Error('Invalid transaction kind');
  }

  let amount = new BigNumber('0');
  let coinType = SUI_NATIVE_COIN;

  for (const obj of transaction.objects) {
    if (obj.kind === 'GasCoin' && payments) {
      // payment all
      coinType = SUI_NATIVE_COIN;

      const objectIds = payments?.reduce((acc, curr) => {
        if (curr.objectId) {
          acc.push(curr.objectId);
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

      amount = objects.reduce((acc, curr) => {
        let temp = acc;
        const content = curr.data?.content;
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

        amount = result.amounts.reduce((acc, curr) => {
          let current = acc;
          if (curr.kind === 'Input') {
            current = current.plus(new BigNumber(curr.value));
          }
          return current;
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
    to = transaction.address.value;
  }

  const isNative = coinType === SUI_NATIVE_COIN;
  return {
    type: isNative
      ? IDecodedTxActionType.NATIVE_TRANSFER
      : IDecodedTxActionType.TOKEN_TRANSFER,
    isNative,
    coinType,
    amount,
    recipient: to,
  };
}
