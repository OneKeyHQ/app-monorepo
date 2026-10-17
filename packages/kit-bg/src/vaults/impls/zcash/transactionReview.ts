import { z } from 'zod';

import { EOutputsTypeForCoinSelect } from '@onekeyhq/core/src/chains/btc/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  zPrivacyBaseUnits,
  zPrivacyHex,
} from '@onekeyhq/shared/src/utils/privacyTransactionReview';

import type { IEncodedTxZcash } from './types';

// 21 million ZEC.
const ZCASH_MAX_MONEY_ZAT = '2100000000000000';
// Memory sanity bound for PCZT hex payloads (8 MiB of bytes).
export const ZCASH_PCZT_HEX_MAX_CHARS = 16 * 1024 * 1024;

const atomic = zPrivacyBaseUnits(ZCASH_MAX_MONEY_ZAT);
const index = z.number().int().nonnegative().safe();
const hex = zPrivacyHex();
const outpoint = z.object({ txid: hex.length(64), vout: index });
const output = z.object({
  address: z.string(),
  value: atomic,
  payload: z
    .object({
      isChange: z.boolean().optional(),
      bip44Path: z.string().optional(),
      opReturn: z.string().optional(),
      isInscriptionStructure: z.boolean().optional(),
    })
    .optional(),
});
const schema = z.object({
  inputs: z.array(
    outpoint.extend({
      value: atomic,
      address: z.string(),
      path: z.string(),
    }),
  ),
  outputs: z.array(output),
  inputsForCoinSelect: z
    .array(
      z.object({
        txId: z.string(),
        vout: index,
        value: index,
        amount: z.string(),
        address: z.string(),
        path: z.string(),
      }),
    )
    .max(0),
  outputsForCoinSelect: z
    .array(
      z.object({
        type: z.nativeEnum(EOutputsTypeForCoinSelect),
        address: z.string(),
        value: index.optional(),
        amount: z.string().optional(),
      }),
    )
    .max(0),
  fee: atomic,
  txSize: index.optional(),
  zcashMode: z.enum(['transparent', 'privacy']),
  zcashTo: z.string().min(1),
  zcashMemoHex: z
    .string()
    .regex(/^[0-9a-f]{1024}$/)
    .optional(),
  zcashAmountValue: atomic,
  zcashIsMaxSend: z.boolean().optional(),
  zcashSpendSource: z.enum(['orchard', 'ironwood']).optional(),
  pcztHex: zPrivacyHex(ZCASH_PCZT_HEX_MAX_CHARS).optional(),
  signedPcztHex: zPrivacyHex(ZCASH_PCZT_HEX_MAX_CHARS).optional(),
  pcztReservationId: z.string().min(1).optional(),
  zcashTransparentPlan: z
    .object({
      ownerId: z.string().min(1),
      accountIndex: index,
      sendMax: z.boolean(),
      selectedOutpoints: z.array(outpoint),
      change: z
        .object({
          address: z.string().min(1),
          derivationPath: z.string().min(1),
        })
        .optional(),
    })
    .optional(),
  zcashTransparentBuild: z
    .object({
      rawTx: hex,
      txid: hex.length(64),
      feeZat: atomic,
      expiryHeight: index,
      spentOutpoints: z.array(outpoint),
    })
    .optional(),
});

// Parsing also creates a snapshot: desktop/web UI and background share a heap.
export function parseZcashTransaction(value: unknown): IEncodedTxZcash {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new OneKeyLocalError('zcash: invalid transaction review');
  }
  const tx = parsed.data;
  if (
    tx.outputs.length !== 1 ||
    tx.outputs[0].address !== tx.zcashTo ||
    tx.outputs[0].value !== tx.zcashAmountValue ||
    (tx.zcashMode === 'privacy' && tx.inputs.length !== 0)
  ) {
    throw new OneKeyLocalError('zcash: inconsistent transaction review');
  }
  // IEncodedTxBtc requires the `txSize` key even when it is undefined.
  return { ...tx, txSize: tx.txSize };
}
