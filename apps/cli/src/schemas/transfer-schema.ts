import { z } from 'zod';

import {
  btcAddressType,
  btcFeeRate,
  btcFeeTier,
  chainAddress,
  chainId,
  humanAmount,
  tokenId,
} from './common';

export const transferInputSchema = z.object({
  to: chainAddress.describe('Recipient address'),
  amount: humanAmount.describe(
    'Human-readable amount to send. Internally converted to smallest unit for transaction encoding.',
  ),
  token: tokenId
    .optional()
    .describe(
      'Token contract / mint address (chain-specific format validated after --chain is resolved). Omit for native token.',
    ),
  chain: chainId.optional().describe('Target chain. Defaults to last used.'),
  addressType: btcAddressType
    .optional()
    .describe('BTC/TBTC sender address type. Required for BTC/TBTC transfer.'),
  feeRate: btcFeeRate.optional(),
  feeTier: btcFeeTier.optional(),
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
  addressType: btcAddressType
    .optional()
    .describe('BTC/TBTC sender address type'),
});

export const transferDryRunOutputSchema = z.object({
  action: z.string().optional(),
  from: z.string(),
  to: z.string(),
  amount: z.string(),
  token: z.string().optional(),
  chain: z.string(),
  estimatedGas: z.string().optional(),
  addressType: btcAddressType.optional(),
  fee: z.string().optional(),
  feeRate: z.string().optional(),
  txSize: z.number().optional(),
  inputCount: z.number().optional(),
  outputCount: z.number().optional(),
  dryRun: z.literal(true),
});
