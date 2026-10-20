/**
 * The spend key never exists outside the runtime: signing hands over the
 * account's BIP-32 key and the runtime reduces it with the same sc_reduce32
 * that produced the address.
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

export async function signXmrTransaction(params: {
  /** The constructed transaction, as `prepareTransaction` returned it. */
  signableHex: string;
  /** The account's BIP-32 private key. Reduced to the spend key in-runtime. */
  bip32PrivateKeyHex: string;
  review: IXmrTransactionReviewRequest;
}): Promise<IXmrSignedTransaction> {
  const { signableHex, bip32PrivateKeyHex } = params;
  const api = await getXmrPureRuntime();
  const reviewJson = stringUtils.stableStringify(params.review);
  // An older WASM signer silently ignores extra arguments. Require its verifier.
  await api.verifyTransaction(signableHex, reviewJson);
  const value: unknown = JSON.parse(
    await api.signTransactionWithBip32Key(
      signableHex,
      bip32PrivateKeyHex,
      reviewJson,
    ),
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
