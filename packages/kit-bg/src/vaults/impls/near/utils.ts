/* eslint-disable @typescript-eslint/no-unsafe-return */
import BN from 'bn.js';
import { baseDecode, baseEncode } from 'borsh';
import bs58 from 'bs58';
import sha256 from 'js-sha256';
import { isString } from 'lodash';
import * as nearApiJs from 'near-api-js';
import { SignedTransaction } from 'near-api-js/lib/transaction';

import { EAddressEncodings } from '@onekeyhq/core/src/types';
import type { IAddressValidation } from '@onekeyhq/shared/types/address';

import type { Transaction } from 'near-api-js/lib/transaction';

const { parseNearAmount } = nearApiJs.utils.format;

export const FT_TRANSFER_GAS = '30000000000000';
export const FT_TRANSFER_DEPOSIT = '1';
export const FT_STORAGE_DEPOSIT_GAS = parseNearAmount('0.00000000003');
// account creation costs 0.00125 NEAR for storage, 0.00000000003 NEAR for gas
// https://docs.near.org/docs/api/naj-cookbook#wrap-and-unwrap-near
export const FT_MINIMUM_STORAGE_BALANCE = parseNearAmount('0.00125');
// FT_MINIMUM_STORAGE_BALANCE: nUSDC, nUSDT require minimum 0.0125 NEAR. Came to this conclusion using trial and error.
export const FT_MINIMUM_STORAGE_BALANCE_LARGE = parseNearAmount('0.0125');

export { baseDecode, baseEncode };
export { nearApiJs };
export { BN, bs58 };

const IMPLICIT_ACCOUNT_PATTERN = /^[a-z\d]{64}$/;
const REGISTER_ACCOUNT_PATTERN =
  /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;
export function verifyNearAddress(address: string): IAddressValidation {
  let encoding: EAddressEncodings | undefined;
  if (IMPLICIT_ACCOUNT_PATTERN.test(address)) {
    encoding = EAddressEncodings.IMPLICIT_ACCOUNT;
  } else if (REGISTER_ACCOUNT_PATTERN.test(address)) {
    return {
      isValid: true,
      normalizedAddress: address,
      displayAddress: address,
      encoding: EAddressEncodings.REGISTER_ACCOUNT,
    };
  } else if (address.includes(':')) {
    const [prefix, encoded] = address.split(':');
    try {
      if (
        prefix === 'ed25519' &&
        Buffer.from(baseDecode(encoded)).length === 32
      ) {
        encoding = EAddressEncodings.ENCODED_PUBKEY;
      }
    } catch (e) {
      // ignored
    }
  }

  if (encoding) {
    return {
      isValid: true,
      normalizedAddress: address,
      displayAddress: address,
      encoding,
    };
  }

  return {
    isValid: false,
    normalizedAddress: '',
    displayAddress: '',
  };
}

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

export function deserializeSignedTransaction(txStr: string): SignedTransaction {
  /*
const deserializeTransactionsFromString = (transactionsString) => transactionsString.split(',')
  .map(str => Buffer.from(str, 'base64'))
  .map(buffer => utils.serialize.deserialize(transaction.SCHEMA, transaction.Transaction, buffer));
*/
  const buffer = Buffer.from(txStr, 'base64');
  const tx = SignedTransaction.decode(buffer);
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

export function getPublicKey({
  accountPub,
  encoding = 'base58',
  prefix = true,
}: {
  accountPub?: string;
  encoding?: 'hex' | 'base58' | 'buffer';
  prefix?: boolean;
} = {}): string {
  // Before commit a7430c1038763d8d7f51e7ddfe1284e3e0bcc87c, pubkey was stored
  // in hexstring, afterwards it is stored using encoded format.

  const pub = accountPub?.startsWith('ed25519:')
    ? baseDecode(accountPub.split(':')[1]).toString('hex')
    : accountPub;

  const pubKeyBuffer = Buffer.from(pub ?? '', 'hex');

  if (encoding === 'buffer') {
    // return pubKeyBuffer;
  }
  if (encoding === 'base58') {
    const prefixStr = prefix ? 'ed25519:' : '';
    return prefixStr + baseEncode(pubKeyBuffer);
  }
  if (encoding === 'hex') {
    return pubKeyBuffer.toString('hex');
  }
  // if (encoding === 'object') {
  // return nearApiJs.utils.key_pair.PublicKey.from(pubKeyBuffer);
  // }
  return '';
}
