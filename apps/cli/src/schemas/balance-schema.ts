import { z } from 'zod';

import { btcAddressType, chainAddress, chainId, tokenId } from './common';

export const balanceInputSchema = z.object({
  chain: chainId.optional().describe('Target chain. Defaults to last used.'),
  token: tokenId
    .optional()
    .describe('Specific token to query. Omit for all assets.'),
  address: chainAddress
    .optional()
    .describe('Override wallet address to query.'),
  addressType: btcAddressType
    .optional()
    .describe('BTC address type for derived wallet reads.'),
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

export const balanceBtcDerivedOutputSchema = z.object({
  chain: z.string(),
  aggregate: z.object({
    symbol: z.string(),
    balance: z.string(),
    contractAddress: z.literal(''),
    isNative: z.literal(true),
  }),
  items: z.array(
    z.object({
      addressType: btcAddressType,
      label: z.string(),
      deriveType: z.string(),
      addressEncoding: z.union([z.string(), z.number()]),
      address: z.string(),
      path: z.string(),
      balance: z.string(),
      balanceRaw: z.string().optional(),
    }),
  ),
});

export const balanceOutputSchema = z.union([
  balanceTokenOutputSchema,
  balanceAllOutputSchema,
  balanceBtcDerivedOutputSchema,
]);
