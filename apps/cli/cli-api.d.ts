// @generated — do not edit manually
// Generated from zod schemas in src/schemas/
// Run: yarn generate:cli-types
// Generated at: 2026-04-07T03:17:20.408Z

/** Print CLI version and environment */
export interface VersionInput {}

export interface VersionOutput {
  version: string;
  env: string;
}

/** Check API connectivity and latency */
export interface StatusInput {}

export interface StatusOutput {
  status: string;
  env: string;
  latency_ms?: number;
  note?: string;
}

/** Import wallet from mnemonic (read from stdin) */
export interface ImportInput {}

export interface ImportOutput {
  /** Derived wallet address */
  address: string;
}

/** Remove wallet from system keychain */
export interface LogoutInput {}

export interface LogoutOutput {
  status: string;
}

/** Query token balance — all assets or specific token */
export interface BalanceInput {
  /** Target chain. Defaults to last used. */
  chain?: string;
  /** Specific token to query. Omit for all assets. */
  token?: string;
}

export interface BalanceOutput {
  address: string;
  chain: string;
  tokens: {
    symbol: string;
    balance: string;
    contractAddress: string;
    fiatValue: unknown;
    isNative: boolean;
  }[];
}

/** Send native or ERC-20 tokens */
export interface TransferInput {
  /** Recipient address */
  to: string;
  /** Human-readable amount to send. Internally converted to smallest unit for transaction encoding. */
  amount: string;
  /** ERC-20 contract address. Omit for native token. */
  token?: string;
  /** Target chain. Defaults to last used. */
  chain?: string;
  /** Estimate gas without sending */
  dryRun?: boolean;
  /** Skip confirmation prompt */
  yes?: boolean;
}

export interface TransferOutput {
  /** Transaction hash */
  txid: string;
  /** Sender address */
  from: string;
  /** Recipient address */
  to: string;
  /** Human-readable amount sent */
  amount: string;
  /** Chain alias */
  chain: string;
}

/** On-chain transaction history */
export interface HistoryInput {
  /** Chain alias (eth, bsc, polygon) or networkId (evm--1, evm--56) */
  chain?: string;
  /** Include extended fields */
  detail?: boolean;
}

export interface HistoryOutput {}

/** Search tokens by keyword, symbol, or address */
export interface TokenSearchInput {
  /** Search keyword (symbol, name, or address) */
  query: string;
  /** Chain alias (eth, bsc, polygon) or networkId (evm--1, evm--56) */
  chain?: string;
  /** Max results (default 10) */
  limit?: number;
}

export interface TokenSearchOutput {}

/** Detailed token metadata and market data */
export interface TokenInfoInput {
  /** Chain alias (eth, bsc, polygon) or networkId (evm--1, evm--56) */
  chain: string;
  /** Token contract address (0x...) or symbol (ETH, USDC) */
  token: string;
}

export interface TokenInfoOutput {
  name: string;
  symbol: string;
  decimals: number;
  contractAddress: string;
  networkId: string;
  isNative: boolean;
  logoUrl: unknown;
  price: unknown;
  marketCap: unknown;
  fdv: unknown;
  tvl: unknown;
  liquidity: unknown;
  circulatingSupply: unknown;
  holders: unknown;
  priceChange1hPercent: unknown;
  priceChange4hPercent: unknown;
  priceChange24hPercent: unknown;
  extraData: {
    website?: string;
    twitter?: string;
  } | null;
  supportSwap: {
    enable: boolean;
  } | null;
  communityRecognized: boolean;
}

/** Token price with multi-timeframe changes */
export interface TokenPriceInput {
  /** Chain alias (eth, bsc, polygon) or networkId (evm--1, evm--56) */
  chain: string;
  /** Token contract address (0x...) or symbol (ETH, USDC) */
  token: string;
}

export interface TokenPriceOutput {
  symbol: string;
  contractAddress: string;
  networkId: string;
  price: unknown;
  priceChange1mPercent: unknown;
  priceChange5mPercent: unknown;
  priceChange1hPercent: unknown;
  priceChange4hPercent: unknown;
  priceChange24hPercent: unknown;
}

/** Top trending tokens across chains */
export interface TokenTrendingInput {
  /** Chain alias (eth, bsc, polygon) or networkId (evm--1, evm--56) */
  chain?: string;
  limit?: number;
}

export interface TokenTrendingOutput {}

/** Buy/sell activity and volume stats by timeframe */
export interface TokenTradesInput {
  /** Chain alias (eth, bsc, polygon) or networkId (evm--1, evm--56) */
  chain: string;
  /** Token contract address (0x...) or symbol (ETH, USDC) */
  token: string;
}

export interface TokenTradesOutput {
  symbol: string;
  contractAddress: string;
  networkId: string;
  stats: {
    '1m': {
      trades: unknown;
      buys: unknown;
      sells: unknown;
      volume: unknown;
      vBuy: unknown;
      vSell: unknown;
      uniqueWallets: unknown;
    };
    '5m': {
      trades: unknown;
      buys: unknown;
      sells: unknown;
      volume: unknown;
      vBuy: unknown;
      vSell: unknown;
      uniqueWallets: unknown;
    };
    '1h': {
      trades: unknown;
      buys: unknown;
      sells: unknown;
      volume: unknown;
      vBuy: unknown;
      vSell: unknown;
      uniqueWallets: unknown;
    };
    '4h': {
      trades: unknown;
      buys: unknown;
      sells: unknown;
      volume: unknown;
      vBuy: unknown;
      vSell: unknown;
      uniqueWallets: unknown;
    };
    '24h': {
      trades: unknown;
      buys: unknown;
      sells: unknown;
      volume: unknown;
      vBuy: unknown;
      vSell: unknown;
      uniqueWallets: unknown;
    };
  };
}

/** Top token holders and their balances */
export interface TokenLiquidityInput {
  /** Chain alias (eth, bsc, polygon) or networkId (evm--1, evm--56) */
  chain: string;
  /** Token contract address (0x...) or symbol (ETH, USDC) */
  token: string;
}

export interface TokenLiquidityOutput {}

/** Get single token price from market data */
export interface MarketPriceInput {
  /** Chain alias (eth, bsc, polygon) or networkId (evm--1, evm--56) */
  chain: string;
  /** Token contract address (0x...) or symbol (ETH, USDC) */
  token: string;
}

export interface MarketPriceOutput {
  symbol: string;
  contractAddress: string;
  networkId: string;
  price: unknown;
  priceChange1mPercent: unknown;
  priceChange5mPercent: unknown;
  priceChange1hPercent: unknown;
  priceChange4hPercent: unknown;
  priceChange24hPercent: unknown;
}

/** Batch pricing for multiple tokens */
export interface MarketPricesInput {
  /** Comma-separated chain:address pairs (e.g. "eth:0x...,bsc:0x...") */
  tokens: string;
}

export interface MarketPricesOutput {}

/** Candlestick OHLCV data */
export interface MarketKlineInput {
  /** Chain alias (eth, bsc, polygon) or networkId (evm--1, evm--56) */
  chain: string;
  /** Token contract address (0x...) or symbol (ETH, USDC) */
  token: string;
  /** Kline interval. Lowercase = minutes (1m, 5m, 15m, 30m). Uppercase = hours/days (1H, 4H, 1D, 1W). */
  interval: string;
  /** Number of candles (default 100) */
  limit?: number;
}

export interface MarketKlineOutput {}

/** Get real-time swap quotes (read-only, not commitment) */
export interface SwapQuoteInput {
  /** Chain alias (eth, bsc, polygon) or networkId (evm--1, evm--56) */
  chain: string;
  /** Source token address or symbol */
  from: string;
  /** Destination token address or symbol */
  to: string;
  /** Human-readable amount of source token. Sent directly to swap API as-is, NOT converted. */
  amount: string;
  /** Destination chain for cross-chain swap */
  toChain?: string;
  /** Slippage tolerance percent (default 1) */
  slippage?: number;
  /** Preferred swap provider */
  provider?: string;
  /** Sort mode for quotes */
  sort?: string;
}

export interface SwapQuoteOutput {
  quotes: {
    provider: string;
    providerName: string;
    toAmount: unknown;
    fromAmount: unknown;
    minToAmount: unknown;
    estimatedTime: unknown;
    instantRate: unknown;
    isBest: boolean;
    fee: unknown;
    errorMessage?: string;
    allowanceResult?: {
      allowanceTarget: string;
      amount: string;
      shouldResetApprove?: boolean;
    } | null;
  }[];
  security: {
    blocked: boolean;
    overallRisk: "high" | "caution" | "low" | "unknown";
    riskItems: string[];
    cautionItems: string[];
    checks: { [key: string]: unknown };
  };
  metadata: {
    from: {
      symbol: string;
      contractAddress: string;
      decimals: number;
    };
    to: {
      symbol: string;
      contractAddress: string;
      decimals: number;
    };
    amount: string;
    amountSmallestUnit: string;
    slippage: number;
    networkId: string;
    walletAddress: unknown;
  };
}

/** Build unsigned swap transaction and get orderId */
export interface SwapBuildInput {
  /** Chain alias (eth, bsc, polygon) or networkId (evm--1, evm--56) */
  chain: string;
  /** Source token */
  from: string;
  /** Destination token */
  to: string;
  /** Human-readable amount of source token. Sent directly to swap API as-is, NOT converted. */
  amount: string;
  /** Chain alias (eth, bsc, polygon) or networkId (evm--1, evm--56) */
  toChain?: string;
  slippage?: number;
  provider?: string;
  sort?: string;
  /** Skip risk confirmation */
  force?: boolean;
}

export interface SwapBuildOutput {
  orderId: string;
  provider: string;
  providerName: string;
  chain: string;
  from: {
    symbol: string;
    contractAddress: string;
    decimals: number;
  };
  to: {
    symbol: string;
    contractAddress: string;
    decimals: number;
  };
  amount: string;
  amountSmallestUnit: string;
  slippage: number;
  walletAddress: string;
  hasTxData: boolean;
  allowanceResult: {
    allowanceTarget: string;
    amount: string;
    shouldResetApprove?: boolean;
  } | null;
}

/** Sign and broadcast a built swap transaction */
export interface SwapExecuteInput {
  /** Order ID from swap build */
  order: string;
  /** Approve unlimited allowance */
  approveUnlimited?: boolean;
}

export interface SwapExecuteOutput {
  orderId: string;
  status: string;
  txHash: string;
  approveTxHash?: string;
  chain: string;
  from: string;
  to: string;
  amount: string;
  message: string;
}

/** Query swap order or transaction status */
export interface SwapStatusInput {
  /** Order ID */
  order?: string;
  /** Transaction hash */
  tx?: string;
  /** Poll until settled */
  watch?: boolean;
}

export interface SwapStatusOutput {
  state: string;
  crossChainStatus?: string;
  dealReceiveAmount?: string;
  gasFee?: string;
  gasFeeFiatValue?: string;
  crossChainReceiveTxHash?: string;
  txId?: string;
  blockNumber?: number;
  orderId?: string;
  txHash: string;
  stateLabel: string;
  stage?: number;
  totalStages?: number;
}

/** List supported swap networks */
export interface SwapNetworksInput {
  /** Filter for cross-chain networks only */
  bridge?: boolean;
}

export interface SwapNetworksOutput {}

/** Local swap order history */
export interface SwapHistoryInput {}

export interface SwapHistoryOutput {}

/** Token risk assessment — returns overall risk level with item breakdown */
export interface SecurityAuditInput {
  /** Chain alias (eth, bsc, polygon) or networkId (evm--1, evm--56) */
  chain: string;
  /** Token contract address (0x...) or symbol (ETH, USDC) */
  token: string;
}

export interface SecurityAuditOutput {
  symbol: string;
  contractAddress: string;
  networkId: string;
  overallRisk: "high" | "caution" | "low";
  riskItems: string[];
  cautionItems: string[];
  checks: { [key: string]: unknown };
}

/** Preview transaction effects before signing */
export interface SecuritySimulateInput {
  /** Chain alias (eth, bsc, polygon) or networkId (evm--1, evm--56) */
  chain: string;
  /** Target contract address */
  to: string;
  /** Hex-encoded calldata */
  data: string;
  /** Native token value to send */
  value?: string;
  /** Sender address override */
  from?: string;
}

export interface SecuritySimulateOutput {
  type: unknown;
  display?: unknown;
  parsedTx?: unknown | null;
  accountAddress: string;
  isConfirmationRequired: boolean;
}
