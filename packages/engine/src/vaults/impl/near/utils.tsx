/* eslint-disable @typescript-eslint/no-unused-vars */
// import * as transactions from '@onekeyfe/blockchain-libs/dist/provider/chains/near/sdk/transaction';
import BN from 'bn.js';
import { baseDecode, baseEncode, serialize } from 'borsh';
import bs58 from 'bs58';
import sha256 from 'js-sha256';
import { isFunction, isString } from 'lodash';
import * as nearApiJs from 'near-api-js';

import type {
  Action,
  SignedTransaction,
  Transaction,
} from 'near-api-js/lib/transaction';

const { parseNearAmount } = nearApiJs.utils.format;

// TODO replace const from nearApiJs
export const FT_TRANSFER_GAS = '30000000000000';
export const FT_TRANSFER_DEPOSIT = '1';
export const FT_STORAGE_DEPOSIT_GAS = parseNearAmount('0.00000000003');
// account creation costs 0.00125 NEAR for storage, 0.00000000003 NEAR for gas
// https://docs.near.org/docs/api/naj-cookbook#wrap-and-unwrap-near
export const FT_MINIMUM_STORAGE_BALANCE = parseNearAmount('0.00125');
// FT_MINIMUM_STORAGE_BALANCE: nUSDC, nUSDT require minimum 0.0125 NEAR. Came to this conclusion using trial and error.
export const FT_MINIMUM_STORAGE_BALANCE_LARGE = parseNearAmount('0.0125');

export { baseDecode, baseEncode };
export { BN, bs58 };
export { nearApiJs };

export function deserializeTransaction(txStr: string): Transaction {
  /*
const deserializeTransactionsFromString = (transactionsString) => transactionsString.split(',')
  .map(str => Buffer.from(str, 'base64'))
  .map(buffer => utils.serialize.deserialize(transaction.SCHEMA, transaction.Transaction, buffer));
*/
  const buffer = Buffer.from(txStr, 'base64');
  const tx = nearApiJs.utils.serialize.deserialize(
    nearApiJs.transactions.SCHEMA,
    nearApiJs.transactions.Transaction,
    buffer,
  );
  return tx;
}

export function serializeTransaction(
  transaction: Transaction | SignedTransaction | string,
  {
    encoding = 'base64',
  }: {
    encoding?: 'sha256_bs58' | 'base64';
  } = {},
): string {
  if (isString(transaction)) {
    return transaction;
  }
  const message = transaction.encode();

  // **** encoding=sha256_bs58 only for sign, can not deserialize
  if (encoding === 'sha256_bs58') {
    // always return txHash, as txHash is serializable to background, but not message
    const txHash = new Uint8Array(sha256.sha256.array(message));
    // same to txid in NEAR
    return bs58.encode(txHash);
  }

  // **** encoding=base64 for dapp sign, can deserialize
  // const hash = new Uint8Array(sha256.sha256.array(message));
  if (
    typeof Buffer !== 'undefined' &&
    Buffer.from &&
    typeof Buffer.from === 'function'
  ) {
    return Buffer.from(message).toString('base64');
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return message.toString('base64');
}

export function parseJsonFromRawResponse(response: Uint8Array): any {
  return JSON.parse(Buffer.from(response).toString());
}
