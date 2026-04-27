import { z } from 'zod';

import { chainId } from './common';

export const walletHistoryInputSchema = z.object({
  chain: chainId.optional(),
  detail: z.boolean().optional().describe('Include extended fields'),
});

export const walletHistoryOutputSchema = z.array(
  z.object({
    txHash: z.string(),
    type: z.string(),
    status: z.string(),
    from: z.string(),
    to: z.string(),
    sends: z.array(
      z.object({
        token: z.string(),
        amount: z.string(),
        fiatValue: z.string(),
        contractAddress: z.string().optional(),
        isNative: z.boolean().optional(),
      }),
    ),
    receives: z.array(
      z.object({
        token: z.string(),
        amount: z.string(),
        fiatValue: z.string(),
        contractAddress: z.string().optional(),
        isNative: z.boolean().optional(),
      }),
    ),
    gasFee: z.string(),
    gasFeeFiatValue: z.string(),
    timestamp: z.string(),
    block: z.number().nullable().optional(),
    nonce: z.number().optional(),
    confirmations: z.number().nullable().optional(),
    networkName: z.string().optional(),
    label: z.string().optional(),
    contractAddress: z.string().nullable().optional(),
  }),
);
