import BigNumber from 'bignumber.js';
import { z } from 'zod';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  zPrivacyBaseUnits,
  zPrivacyHex,
} from '@onekeyhq/shared/src/utils/privacyTransactionReview';

import type {
  IXmrNetwork,
  IXmrTransactionReviewRequest,
} from './sdkXmrRuntime/types';
import type { IEncodedTxXmr } from './types';

const atomic = zPrivacyBaseUnits('18446744073709551615');
const hex = zPrivacyHex(8 * 1024 * 1024);
const preparedSchema = z.object({
  signableHex: hex,
  amountAtomic: atomic,
  feeAtomic: atomic,
  changeAtomic: atomic,
  inputCount: z.number().int().positive().max(1024),
});
const sendSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  amount: z.string().min(1),
  priority: z.enum(['unimportant', 'normal', 'elevated', 'priority']),
  isMaxSend: z.boolean().optional(),
});
const transactionSchema = preparedSchema
  .merge(sendSchema)
  .extend({ chainTip: z.number().int().nonnegative().safe() })
  .refine((value) => {
    const amount = new BigNumber(value.amount);
    return amount.isFinite() && amount.shiftedBy(12).eq(value.amountAtomic);
  });

export function parseXmrSendRequest(value: unknown) {
  const parsed = sendSchema.extend({ amountAtomic: atomic }).safeParse(value);
  if (
    !parsed.success ||
    !new BigNumber(parsed.data.amount)
      .shiftedBy(12)
      .eq(parsed.data.amountAtomic)
  ) {
    throw new OneKeyLocalError('xmr: invalid transaction request');
  }
  return parsed.data;
}

export function parseXmrPreparedTransaction(value: unknown) {
  const parsed = preparedSchema.safeParse(value);
  if (!parsed.success) {
    throw new OneKeyLocalError('xmr: invalid prepared transaction');
  }
  return parsed.data;
}

export function parseXmrTransaction(value: unknown) {
  const parsed = transactionSchema.safeParse(value);
  if (!parsed.success) {
    throw new OneKeyLocalError('xmr: invalid transaction review');
  }
  return parsed.data;
}

export function getXmrReviewRequest(
  encodedTx: IEncodedTxXmr,
  network: IXmrNetwork,
): IXmrTransactionReviewRequest {
  const reviewed = parseXmrTransaction(encodedTx);
  return {
    network,
    fromAddress: reviewed.from,
    toAddress: reviewed.to,
    amountAtomic: reviewed.amountAtomic,
    feeAtomic: reviewed.feeAtomic,
    changeAtomic: reviewed.changeAtomic,
    isMaxSend: reviewed.isMaxSend === true,
  };
}
