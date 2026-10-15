/**
 * The spend key is never stored; it's derived from the account's BIP-32 key
 * for the duration of one signature, by the runtime's single implementation of sc_reduce32.
 */

import { z } from 'zod';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { getXmrPureRuntime } from './address';

import type { IXmrTransactionReviewRequest } from './types';

export type IXmrSignedTransaction = {
  /**
   * Fixed at signing, before any node sees it, so the pending record built
   * from it can still be reconciled if a broadcast reply is lost.
   */
  txid: string;
  /** The transaction as it goes on the wire. */
  rawHex: string;
  sizeBytes: number;
};

/** The spend scalar for an account's BIP-32 private key, reduced in-runtime. */
export async function deriveXmrSpendPrivateKey(
  bip32PrivateKeyHex: string,
): Promise<string> {
  const api = await getXmrPureRuntime();
  // A bare hex string, not JSON -- the runtime returns the scalar itself.
  return api.spendScalar(bip32PrivateKeyHex);
}

export async function signXmrTransaction(params: {
  /** The constructed transaction, as `prepareTransaction` returned it. */
  signableHex: string;
  /** The account's BIP-32 private key. Reduced to a spend scalar in-runtime. */
  bip32PrivateKeyHex: string;
  review: IXmrTransactionReviewRequest;
}): Promise<IXmrSignedTransaction> {
  const { signableHex, bip32PrivateKeyHex } = params;
  const api = await getXmrPureRuntime();
  const reviewJson = stringUtils.stableStringify(params.review);
  // An older WASM signer silently ignores extra arguments. Require its verifier.
  await api.verifyTransaction(signableHex, reviewJson);
  const spendPrivateKeyHex = await deriveXmrSpendPrivateKey(bip32PrivateKeyHex);
  const value: unknown = JSON.parse(
    await api.signTransaction(signableHex, spendPrivateKeyHex, reviewJson),
  );
  const result = z
    .object({
      txid: z.string().regex(/^[0-9a-f]{64}$/),
      rawHex: z.string().regex(/^(?:[0-9a-f]{2})+$/),
      sizeBytes: z.number().int().positive().safe(),
    })
    .safeParse(value);
  if (
    !result.success ||
    result.data.rawHex.length !== result.data.sizeBytes * 2
  ) {
    throw new OneKeyLocalError('xmr: invalid signed transaction response');
  }
  return result.data;
}
