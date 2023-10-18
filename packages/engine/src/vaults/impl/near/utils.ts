/* eslint-disable @typescript-eslint/no-unused-vars */
import BN from 'bn.js';
import { baseDecode, baseEncode } from 'borsh';
import bs58 from 'bs58';
import sha256 from 'js-sha256';
import { isString } from 'lodash';
import * as nearApiJs from 'near-api-js';
import { SignedTransaction } from 'near-api-js/lib/transaction';

import type { AddressValidation } from '@onekeyhq/engine/src/types/provider';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { TxStatus } from '../../../types/covalent';
import { IDecodedTxActionType } from '../../types';
import { EVMDecodedTxType } from '../evm/decoder/types';

import type { Signer } from '../../../proxy';
import type {
  IDecodedTx,
  IDecodedTxAction,
  IDecodedTxLegacy,
  ISignedTxPro,
  IUnsignedTxPro,
} from '../../types';
import type { EVMDecodedItemERC20Transfer } from '../evm/decoder/types';
import type { Action, Transaction } from 'near-api-js/lib/transaction';

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

function getLegacyActionInfo(tx: IDecodedTx) {
  let txAction = tx.actions.length === 1 ? tx.actions[0] : null;
  const isNativeTransfer =
    txAction && txAction?.type === IDecodedTxActionType.NATIVE_TRANSFER;
  const defaultResult = {
    txType: EVMDecodedTxType.NATIVE_TRANSFER,
    actionInfo: txAction,
  };
  if (isNativeTransfer) {
    return defaultResult;
  }
  const testIsTokenTransfer = (action: IDecodedTxAction | null) =>
    action && action.type === IDecodedTxActionType.TOKEN_TRANSFER;
  let isTokenTransfer = testIsTokenTransfer(txAction);
  if (!isTokenTransfer) {
    txAction = tx.actions.length === 2 ? tx.actions[1] : null;
  }
  isTokenTransfer = testIsTokenTransfer(txAction);
  if (isTokenTransfer) {
    return {
      txType: EVMDecodedTxType.TOKEN_TRANSFER,
      actionInfo: txAction,
    };
  }
  return defaultResult;
}

export function decodedTxToLegacy(tx: IDecodedTx): IDecodedTxLegacy {
  const { txType, actionInfo } = getLegacyActionInfo(tx);
  let amount = '0';
  let valueOnChain = '0';
  let info = null;
  let to = '';
  if (
    actionInfo?.type === IDecodedTxActionType.NATIVE_TRANSFER &&
    actionInfo?.nativeTransfer
  ) {
    amount = actionInfo.nativeTransfer.amount;
    valueOnChain = actionInfo.nativeTransfer.amountValue;
    to = actionInfo.nativeTransfer?.to;
  }
  if (
    actionInfo?.type === IDecodedTxActionType.TOKEN_TRANSFER &&
    actionInfo?.tokenTransfer
  ) {
    const infoLegacy: EVMDecodedItemERC20Transfer = {
      type: EVMDecodedTxType.TOKEN_TRANSFER,
      token: actionInfo.tokenTransfer.tokenInfo,
      amount: actionInfo.tokenTransfer.amount,
      value: actionInfo.tokenTransfer.amountValue,
      recipient: actionInfo?.tokenTransfer.to,
    };
    to = actionInfo.tokenTransfer.to;
    info = infoLegacy;
  }
  return {
    txType,
    blockSignedAt: 0,
    fromType: 'OUT',
    txStatus: TxStatus.Pending,
    mainSource: 'raw',

    symbol: 'UNKNOWN',
    amount,
    value: valueOnChain,

    fromAddress: tx.signer,
    toAddress: to,
    nonce: tx.nonce,
    txHash: tx.txid,

    info, // tokenTransferInfo
    // @ts-ignore
    _infoActionsLength: tx.actions.length,

    gasInfo: {
      gasLimit: 0,
      gasPrice: '0',
      maxFeePerGas: '0',
      maxPriorityFeePerGas: '0',
      maxPriorityFeePerGasInGwei: '0',
      maxFeePerGasInGwei: '0',
      maxFeeSpend: '0',
      feeSpend: '0',
      gasUsed: 0,
      gasUsedRatio: 0,
      effectiveGasPrice: '0',
      effectiveGasPriceInGwei: '0',
    },

    data: '',
    chainId: 0,

    total: '0',
  };
}

export async function signTransaction(
  unsignedTx: IUnsignedTxPro,
  signer: Signer,
): Promise<ISignedTxPro> {
  const transaction = unsignedTx.payload
    .nativeTx as nearApiJs.transactions.Transaction;
  const txHash: string = serializeTransaction(transaction, {
    encoding: 'sha256_bs58',
  });
  const digest = baseDecode(txHash);
  const res = await signer.sign(digest);
  const signature = new Uint8Array(res[0]);

  const signedTx = new nearApiJs.transactions.SignedTransaction({
    transaction,
    signature: new nearApiJs.transactions.Signature({
      keyType: transaction.publicKey.keyType,
      data: signature,
    }),
  });
  const rawTx = serializeTransaction(signedTx);

  debugLogger.engine.info('NEAR signTransaction', {
    unsignedTx,
    signedTx,
    signer,
    txHash,
  });

  const publicKey = await signer.getPubkey(true);

  return {
    txid: txHash,
    rawTx,
    digest: Buffer.from(digest).toString('hex'),
    signature: Buffer.from(signature).toString('hex'),
    publicKey: Buffer.from(publicKey).toString('hex'),
    encodedTx: unsignedTx.encodedTx,
  };
}

const IMPLICIT_ACCOUNT_PATTERN = /^[a-z\d]{64}$/;
const REGISTER_ACCOUNT_PATTERN =
  /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;

export function verifyNearAddress(address: string): AddressValidation {
  let encoding: string | undefined;
  if (IMPLICIT_ACCOUNT_PATTERN.test(address)) {
    encoding = 'IMPLICIT_ACCOUNT';
  } else if (REGISTER_ACCOUNT_PATTERN.test(address)) {
    return {
      isValid: true,
      normalizedAddress: address,
      displayAddress: address,
      encoding: 'REGISTER_ACCOUNT',
    };
  } else if (address.includes(':')) {
    const [prefix, encoded] = address.split(':');
    try {
      if (
        prefix === 'ed25519' &&
        Buffer.from(baseDecode(encoded)).length === 32
      ) {
        encoding = 'ENCODED_PUBKEY';
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
  };
}
