import { z } from 'zod';

import {
  btcAddressType,
  chainAddress,
  chainId,
  positiveIntString,
  tokenId,
} from './common';

export const walletHistoryInputSchema = z.object({
  chain: chainId.optional(),
  token: tokenId.optional().describe('Filter by token where supported'),
  address: chainAddress
    .optional()
    .describe('Override wallet address to query.'),
  addressType: btcAddressType
    .optional()
    .describe('BTC address type for derived wallet reads.'),
  limit: positiveIntString.optional(),
  detail: z.boolean().optional().describe('Include extended fields'),
});

const walletHistoryItemSchema = z.object({
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
});

export const walletHistoryListOutputSchema = z.array(walletHistoryItemSchema);

export const walletHistoryBtcDerivedOutputSchema = z.object({
  chain: z.string(),
  aggregate: z.literal(true),
  items: z.array(walletHistoryItemSchema),
  addressTypes: z.array(
    z.object({
      addressType: btcAddressType,
      label: z.string(),
      address: z.string(),
      count: z.number(),
    }),
  ),
});

export const walletHistoryOutputSchema = z.union([
  walletHistoryListOutputSchema,
  walletHistoryBtcDerivedOutputSchema,
]);
