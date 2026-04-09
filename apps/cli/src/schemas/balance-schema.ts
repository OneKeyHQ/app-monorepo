import { z } from 'zod';

import { chainId, tokenId } from './common';

export const balanceInputSchema = z.object({
  chain: chainId.optional().describe('Target chain. Defaults to last used.'),
  token: tokenId
    .optional()
    .describe('Specific token to query. Omit for all assets.'),
});

export const balanceTokenOutputSchema = z.object({
  address: z.string(),
  chain: z.string(),
  token: z.string(),
  contractAddress: z.string(),
  balance: z.string().describe('Human-readable balance'),
  balanceRaw: z
    .string()
    .optional()
    .describe('Smallest unit balance (ERC-20 only)'),
});

export const balanceAllOutputSchema = z.object({
  address: z.string(),
  chain: z.string(),
  tokens: z.array(
    z.object({
      symbol: z.string(),
      balance: z.string(),
      contractAddress: z.string(),
      fiatValue: z.string().nullable(),
      isNative: z.boolean(),
    }),
  ),
});
