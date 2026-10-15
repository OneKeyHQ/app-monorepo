import { z } from 'zod';

import type { IZcashPcztReviewRequest } from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  getPrivacyTransactionReviewDigest,
  zPrivacyHex,
} from '@onekeyhq/shared/src/utils/privacyTransactionReview';

import type { IEncodedTxZcash } from './types';

const reviewSchema = z.object({
  network: z.literal('main'),
  ufvk: z.string().min(1),
  toAddress: z.string().min(1),
  amountZat: z.string().regex(/^[1-9][0-9]*$/),
  feeZat: z.string().regex(/^(0|[1-9][0-9]*)$/),
  spendSource: z.enum(['orchard', 'ironwood']),
  isMaxSend: z.boolean(),
  memoHex: z
    .string()
    .regex(/^[0-9a-f]{1024}$/)
    .optional(),
});

export function getZcashPcztReviewRequest(
  encodedTx: IEncodedTxZcash,
  ufvk: string,
): IZcashPcztReviewRequest {
  const parsed = reviewSchema.safeParse({
    network: 'main',
    ufvk,
    toAddress: encodedTx.zcashTo,
    amountZat: encodedTx.zcashAmountValue,
    feeZat: encodedTx.fee,
    spendSource: encodedTx.zcashSpendSource,
    isMaxSend: encodedTx.zcashIsMaxSend ?? false,
    memoHex: encodedTx.zcashMemoHex,
  });
  if (
    !parsed.success ||
    encodedTx.zcashMode !== 'privacy' ||
    !zPrivacyHex().safeParse(encodedTx.pcztHex).success
  ) {
    throw new OneKeyLocalError('zcash: invalid transaction review');
  }
  return parsed.data;
}

export function getZcashPcztReviewDigest(params: {
  accountId: string;
  networkId: string;
  encodedTx: IEncodedTxZcash;
  ufvk: string;
}): string {
  return getPrivacyTransactionReviewDigest({
    accountId: params.accountId,
    networkId: params.networkId,
    proposalHex: params.encodedTx.pcztHex ?? '',
    intent: getZcashPcztReviewRequest(params.encodedTx, params.ufvk),
  });
}
