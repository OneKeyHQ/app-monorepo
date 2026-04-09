// apps/cli/src/schemas/index.ts

// Registry
export { defineCommand, getSchemaRegistry, resetRegistry } from './registry';
export type { ICommandSchema } from './registry';

// Common primitives
export {
  chainId,
  ethAddress,
  humanAmount,
  positiveIntString,
  tokenId,
} from './common';

// Transfer
export {
  transferDryRunOutputSchema,
  transferInputSchema,
  transferOptionsSchema,
  transferOutputSchema,
} from './transfer-schema';
export type { ITransferOptions } from './transfer-schema';

// Balance
export {
  balanceAllOutputSchema,
  balanceInputSchema,
  balanceTokenOutputSchema,
} from './balance-schema';

// Wallet History
export {
  walletHistoryInputSchema,
  walletHistoryOutputSchema,
} from './wallet-history-schema';

// Import / Logout / Status / Version
export { importInputSchema, importOutputSchema } from './import-schema';
export { logoutInputSchema, logoutOutputSchema } from './logout-schema';
export { statusInputSchema, statusOutputSchema } from './status-schema';
export { versionInputSchema, versionOutputSchema } from './version-schema';

// Token group
export {
  tokenInfoInputSchema,
  tokenInfoOutputSchema,
  tokenLiquidityInputSchema,
  tokenLiquidityOutputSchema,
  tokenPriceInputSchema,
  tokenPriceOutputSchema,
  tokenSearchInputSchema,
  tokenSearchOutputSchema,
  tokenTradesInputSchema,
  tokenTradesOutputSchema,
  tokenTrendingInputSchema,
  tokenTrendingOutputSchema,
} from './token-schemas';

// Market group
export {
  marketKlineInputSchema,
  marketKlineOutputSchema,
  marketPriceInputSchema,
  marketPriceOutputSchema,
  marketPricesInputSchema,
  marketPricesOutputSchema,
} from './market-schemas';

// Swap group
export {
  swapBuildInputSchema,
  swapBuildOutputSchema,
  swapExecuteInputSchema,
  swapExecuteOutputSchema,
  swapHistoryInputSchema,
  swapHistoryOutputSchema,
  swapNetworksInputSchema,
  swapNetworksOutputSchema,
  swapQuoteInputSchema,
  swapQuoteOutputSchema,
  swapStatusInputSchema,
  swapStatusOutputSchema,
} from './swap-schemas';

// Security group
export {
  securityAuditInputSchema,
  securityAuditOutputSchema,
  securitySimulateInputSchema,
  securitySimulateOutputSchema,
} from './security-schemas';
