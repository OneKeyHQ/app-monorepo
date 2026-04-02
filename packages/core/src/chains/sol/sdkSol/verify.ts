import { Transaction, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { parseToNativeTx } from './parse';

import type { Message, PublicKey } from '@solana/web3.js';

function getFeePayerFromVersionedTransaction(
  versionedTx: VersionedTransaction,
) {
  const message = versionedTx.message;

  let feePayer: PublicKey;

  if ('staticAccountKeys' in message) {
    feePayer = message.staticAccountKeys?.[0];
  } else if ('accountKeys' in message) {
    feePayer = (message as Message).accountKeys?.[0];
  } else {
    throw new OneKeyLocalError('Unknown transaction message format');
  }

  return feePayer.toString();
}

export function verifySolSignedTxMatched({
  signerAddress,
  rawTx,
  txid,
  encoding = 'bs58',
}: {
  signerAddress: string;
  rawTx: string;
  txid: string;
  encoding?: 'bs58' | 'base64';
}) {
  const transaction = parseToNativeTx(rawTx, encoding);

  if (!transaction) {
    throw new OneKeyLocalError('Invalid Solana transaction');
  }

  if (transaction instanceof VersionedTransaction) {
    if (!transaction.signatures[0]) {
      throw new OneKeyLocalError('Solana transaction signature not found');
    }
    const txidFromRawTx = bs58.encode(transaction.signatures[0]);

    if (txidFromRawTx !== txid) {
      throw new OneKeyLocalError('Solana txid not match');
    }

    const feePayer = getFeePayerFromVersionedTransaction(transaction);
    if (feePayer !== signerAddress) {
      throw new OneKeyLocalError('Solana fee payer address not match');
    }
  } else if (transaction instanceof Transaction) {
    if (!transaction.signatures[0].signature) {
      throw new OneKeyLocalError('Solana transaction signature not found');
    }
    const txidFromRawTx = bs58.encode(transaction.signatures[0].signature);

    if (txidFromRawTx !== txid) {
      throw new OneKeyLocalError('Solana txid not match');
    }

    const feePayer =
      transaction.feePayer?.toString() ??
      transaction.signatures[0].publicKey.toString();
    if (feePayer !== signerAddress) {
      throw new OneKeyLocalError('Solana fee payer address not match');
    }
  } else {
    throw new OneKeyLocalError('Unknown transaction type');
  }
}
