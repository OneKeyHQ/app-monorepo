import { SUI_TYPE_ARG } from '@mysten/sui.js';
import BigNumber from 'bignumber.js';

import { IDecodedTxActionType } from '../../../types';

import type {
  TransactionBlockInput,
  TransferObjectsTransaction,
} from '@mysten/sui.js';

export function decodeActionWithTransferObjects(
  transaction: TransferObjectsTransaction,
  inputs: TransactionBlockInput[],
) {
  if (transaction.kind !== 'TransferObjects') {
    throw new Error('Invalid transaction kind');
  }

  let amount = new BigNumber('0');
  for (const obj of transaction.objects) {
    if (obj.kind === 'Input') {
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
    } else if (obj.kind === 'Result') {
      const inputResult = inputs[obj.index];
      if (inputResult.type === 'pure') {
        amount = new BigNumber(inputResult.value);
        break;
      }
      if (inputResult.type === 'object') {
        // NFT
      }
    }
  }

  let to = '';
  if (transaction.address.kind === 'Input') {
    to = transaction.address.value;
  }

  const coinType = SUI_TYPE_ARG;
  const isNative = coinType === SUI_TYPE_ARG;
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
