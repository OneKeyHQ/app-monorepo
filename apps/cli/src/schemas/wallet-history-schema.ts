import { z } from 'zod';

import { chainId } from './common';

export const walletHistoryInputSchema = z.object({
  chain: chainId.optional(),
  detail: z.boolean().optional().describe('Include extended fields'),
});

export const walletHistoryOutputSchema = z.array(
  z.object({
    hash: z.string(),
    from: z.string(),
    to: z.string(),
    value: z.string(),
    block: z.string().optional(),
    nonce: z.number().optional(),
    confirmations: z.number().optional(),
    networkName: z.string().optional(),
    tokenSymbol: z.string().optional(),
  }),
);
