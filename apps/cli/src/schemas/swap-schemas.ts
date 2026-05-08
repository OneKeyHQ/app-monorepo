import { z } from 'zod';

import { chainId, humanAmount, tokenId } from './common';

// --- shared sub-schemas ---
const tokenMeta = z.object({
  symbol: z.string(),
  contractAddress: z.string(),
  decimals: z.number(),
});

const allowanceResult = z
  .object({
    allowanceTarget: z.string(),
    amount: z.string(),
    shouldResetApprove: z.boolean().optional(),
  })
  .nullable();

const swapQuoteFee = z
  .object({
    estimatedFeeFiatValue: z.number().optional(),
  })
  .passthrough();

// ---- swap quote ----
export const swapQuoteInputSchema = z.object({
  chain: chainId,
  from: tokenId.describe('Source token address or symbol'),
  to: tokenId.describe('Destination token address or symbol'),
  amount: humanAmount.describe(
    'Human-readable amount of source token. Sent directly to swap API as-is, NOT converted.',
  ),
  toChain: chainId
    .optional()
    .describe('Destination chain for cross-chain swap'),
  slippage: z.coerce
    .number()
    .optional()
    .describe('Slippage tolerance percent (default 1)'),
  provider: z.string().optional().describe('Preferred swap provider'),
  sort: z.string().optional().describe('Sort mode for quotes'),
});

export const swapQuoteOutputSchema = z.object({
  quotes: z.array(
    z.object({
      provider: z.string(),
      providerName: z.string(),
      toAmount: z.string().nullable(),
      fromAmount: z.string().nullable(),
      minToAmount: z.string().nullable(),
      estimatedTime: z.union([z.string(), z.number()]).nullable(),
      instantRate: z.string().nullable(),
      isBest: z.boolean(),
      fee: swapQuoteFee.nullable(),
      errorMessage: z.string().optional(),
      allowanceResult: allowanceResult.optional(),
    }),
  ),
  security: z.object({
    blocked: z.boolean(),
    overallRisk: z.enum(['high', 'caution', 'low', 'unknown']),
    riskItems: z.array(z.string()),
    cautionItems: z.array(z.string()),
    checks: z.record(z.unknown()),
  }),
  metadata: z.object({
    from: tokenMeta,
    to: tokenMeta,
    amount: z.string(),
    amountSmallestUnit: z.string(),
    slippage: z.number(),
    networkId: z.string(),
    walletAddress: z.string().nullable(),
  }),
});

// ---- swap build ----
export const swapBuildInputSchema = z.object({
  chain: chainId,
  from: tokenId.describe('Source token'),
  to: tokenId.describe('Destination token'),
  amount: humanAmount.describe(
    'Human-readable amount of source token. Sent directly to swap API as-is, NOT converted.',
  ),
  toChain: chainId.optional(),
  slippage: z.coerce.number().optional(),
  provider: z.string().optional(),
  sort: z.string().optional(),
  force: z.boolean().optional().describe('Skip risk confirmation'),
});

export const swapBuildOutputSchema = z.object({
  orderId: z.string(),
  provider: z.string(),
  providerName: z.string(),
  chain: z.string(),
  from: tokenMeta,
  to: tokenMeta,
  amount: z.string(),
  amountSmallestUnit: z.string(),
  slippage: z.number(),
  walletAddress: z.string(),
  hasTxData: z.boolean(),
  allowanceResult,
});

// ---- swap execute ----
export const swapExecuteInputSchema = z.object({
  order: z.string().describe('Order ID from swap build'),
  approveUnlimited: z
    .boolean()
    .optional()
    .describe('Approve unlimited allowance'),
});

export const swapExecuteOutputSchema = z.object({
  orderId: z.string(),
  status: z.literal('executed'),
  txHash: z.string(),
  approveTxHash: z.string().optional(),
  chain: z.string(),
  from: z.string(),
  to: z.string(),
  amount: z.string(),
  message: z.string(),
});

// ---- swap status ----
export const swapStatusInputSchema = z.object({
  order: z.string().optional().describe('Order ID'),
  tx: z.string().optional().describe('Transaction hash'),
  watch: z.boolean().optional().describe('Poll until settled'),
});

export const swapStatusOutputSchema = z.object({
  state: z.string(),
  crossChainStatus: z.string().optional(),
  dealReceiveAmount: z.string().optional(),
  gasFee: z.string().optional(),
  gasFeeFiatValue: z.string().optional(),
  crossChainReceiveTxHash: z.string().optional(),
  txId: z.string().optional(),
  blockNumber: z.number().optional(),
  orderId: z.string().optional(),
  txHash: z.string(),
  stateLabel: z.string(),
  stage: z.number().optional(),
  totalStages: z.number().optional(),
});

// ---- swap networks ----
export const swapNetworksInputSchema = z.object({
  bridge: z
    .boolean()
    .optional()
    .describe('Filter for cross-chain networks only'),
});

export const swapNetworksOutputSchema = z.array(
  z.object({
    networkId: z.string(),
    name: z.string(),
    chainId: z.string(),
    nativeSymbol: z.string(),
    supportSingleSwap: z.boolean(),
    supportCrossChainSwap: z.boolean(),
    supportLimit: z.boolean(),
  }),
);

// ---- swap history ----
export const swapHistoryInputSchema = z.object({});

export const swapHistoryOutputSchema = z.array(
  z.object({
    orderId: z.string(),
    status: z.string(),
    chain: z.string(),
    from: z.string().nullable(),
    to: z.string().nullable(),
    amount: z.string(),
    txHash: z.string().nullable(),
    provider: z.string().nullable(),
    createdAt: z.number(),
    updatedAt: z.number(),
  }),
);
