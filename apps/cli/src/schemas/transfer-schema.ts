import { z } from 'zod';

import { chainId, ethAddress, humanAmount } from './common';

export const transferInputSchema = z.object({
  to: ethAddress.describe('Recipient address'),
  amount: humanAmount.describe(
    'Human-readable amount to send. Internally converted to smallest unit for transaction encoding.',
  ),
  token: ethAddress
    .optional()
    .describe('ERC-20 contract address. Omit for native token.'),
  chain: chainId.optional().describe('Target chain. Defaults to last used.'),
  dryRun: z.boolean().optional().describe('Estimate gas without sending'),
  yes: z.boolean().optional().describe('Skip confirmation prompt'),
});

/** @deprecated Use transferInputSchema */
export const transferOptionsSchema = transferInputSchema;

export type ITransferOptions = z.infer<typeof transferInputSchema>;

export const transferOutputSchema = z.object({
  txid: z.string().describe('Transaction hash'),
  from: z.string().describe('Sender address'),
  to: z.string().describe('Recipient address'),
  amount: z.string().describe('Human-readable amount sent'),
  chain: z.string().describe('Chain alias'),
});

export const transferDryRunOutputSchema = z.object({
  action: z.string(),
  from: z.string(),
  to: z.string(),
  amount: z.string(),
  token: z.string(),
  chain: z.string(),
  estimatedGas: z.string(),
  dryRun: z.literal(true),
});
