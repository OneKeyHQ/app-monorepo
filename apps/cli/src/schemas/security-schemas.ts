import { z } from 'zod';

import { chainId, ethAddress, humanAmount, tokenId } from './common';

// ---- security audit ----
export const securityAuditInputSchema = z.object({
  chain: chainId,
  token: tokenId,
});

export const securityAuditOutputSchema = z.object({
  symbol: z.string(),
  contractAddress: z.string(),
  networkId: z.string(),
  overallRisk: z.enum(['high', 'caution', 'low']),
  riskItems: z.array(z.string()),
  cautionItems: z.array(z.string()),
  checks: z.record(z.unknown()),
});

// ---- security simulate ----
export const securitySimulateInputSchema = z.object({
  chain: chainId,
  to: ethAddress.describe('Target contract address'),
  data: z.string().describe('Hex-encoded calldata'),
  value: humanAmount.optional().describe('Native token value to send'),
  from: ethAddress.optional().describe('Sender address override'),
});

export const securitySimulateOutputSchema = z.object({
  type: z.string().nullable(),
  display: z.unknown().nullable().optional(),
  parsedTx: z.unknown().nullable().optional(),
  accountAddress: z.string(),
  isConfirmationRequired: z.boolean(),
});
