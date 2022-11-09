/* eslint-disable @typescript-eslint/no-use-before-define */
import BigNumber from 'bignumber.js';
import { sign } from 'ripple-keypairs';
import { encode, encodeForSigning, hashes } from 'xrpl';

import type { Transaction } from 'xrpl';

export function signature(
  transaction: Transaction,
  publicKey: string,
  privateKey: string,
) {
  const tx = { ...transaction };

  if (tx.TxnSignature || tx.Signers) {
    throw new Error(
      'txJSON must not contain "TxnSignature" or "Signers" properties',
    );
  }

  removeTrailingZeros(tx);

  const txToSignAndEncode = { ...tx };

  txToSignAndEncode.SigningPubKey = publicKey;
  txToSignAndEncode.TxnSignature = computeSignature(
    txToSignAndEncode,
    privateKey,
  );

  const serialized = encode(txToSignAndEncode);

  return {
    tx_blob: serialized,
    hash: hashes.hashSignedTx(serialized),
  };
}

function removeTrailingZeros(tx: Transaction): void {
  if (
    tx.TransactionType === 'Payment' &&
    typeof tx.Amount !== 'string' &&
    tx.Amount.value.includes('.') &&
    tx.Amount.value.endsWith('0')
  ) {
    // eslint-disable-next-line no-param-reassign -- Required to update Transaction.Amount.value
    tx.Amount = { ...tx.Amount };
    // eslint-disable-next-line no-param-reassign -- Required to update Transaction.Amount.value
    tx.Amount.value = new BigNumber(tx.Amount.value).toString();
  }
}

function computeSignature(tx: Transaction, privateKey: string): string {
  return sign(encodeForSigning(tx), privateKey);
}
