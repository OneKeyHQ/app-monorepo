/** Signing hands the runtime the account's BIP-32 key; the spend key only exists reduced inside it. */

import { z } from 'zod';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors/errors/localError';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { getXmrPureRuntime } from './address';

import type { IXmrTransactionReviewRequest } from './types';

export type IXmrSignedTransaction = {
  /** Fixed at signing, so a pending record can be reconciled if a broadcast reply is lost. */
  txid: string;
  rawHex: string;
  sizeBytes: number;
  /** Tx private keys for payment proofs; absent from older runtimes. */
  txKeyHex?: string;
  additionalTxKeysHex?: string[];
};

const txKeyHex = z.string().regex(/^[0-9a-f]{64}$/);

export async function signXmrTransaction(params: {
  signableHex: string;
  /** The account's BIP-32 private key. Reduced to the spend key in-runtime. */
  bip32PrivateKeyHex: string;
  review: IXmrTransactionReviewRequest;
}): Promise<IXmrSignedTransaction> {
  const { signableHex, bip32PrivateKeyHex } = params;
  const api = await getXmrPureRuntime();
  const reviewJson = stringUtils.stableStringify(params.review);
  // Verify the review before any key is used.
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
      txKeyHex: txKeyHex.optional(),
      additionalTxKeysHex: z.array(txKeyHex).max(16).optional(),
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
