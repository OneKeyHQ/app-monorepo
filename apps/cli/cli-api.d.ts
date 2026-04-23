/* eslint-disable */
// @generated — do not edit manually
// Generated from zod schemas in src/schemas/
// Run: yarn generate:cli-types
// Generated at: 2026-04-17T08:26:05.253Z

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
  tokens: ({
    symbol: string;
    balance: string;
    contractAddress: string;
    fiatValue: string | null;
    isNative: boolean;
  })[];
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

/** Authenticate with a OneKey App Bot Wallet */
export interface AuthLoginInput {
  /** Authenticate with a OneKey App Bot Wallet */
  appTransfer?: boolean;
}

export interface AuthLoginOutput {
  auth_status: string;
  login_method: string;
  source_label: string | null;
  display_address: string | null;
  storage_backend: "macos-keychain" | "linux-secret-service";
}

/** Show the current auth session */
export interface AuthStatusInput {}

export interface AuthStatusOutput {
  authStatus: "authenticated" | "unauthenticated";
  hasSecrets: boolean;
  storageBackend: "macos-keychain" | "linux-secret-service";
  loginMethod: "app_transfer" | null;
  walletKind: "hd" | null;
  sourceLabel: string | null;
  displayAddress: string | null;
  importedAt: string | null;
}

/** Log out of the current auth session */
export interface AuthLogoutInput {}

export interface AuthLogoutOutput {
  status: "logged_out" | "already_logged_out" | "cancelled";
  authStatus: "authenticated" | "unauthenticated";
  changed: boolean;
  sourceLabel: string | null;
  displayAddress: string | null;
}

/** On-chain transaction history */
export interface HistoryInput {
  /** Chain alias (eth, bsc, polygon) or networkId (evm--1, evm--56) */
  chain?: string;
  /** Include extended fields */
  detail?: boolean;
}

export type HistoryOutput = {
  hash: string;
  from: string;
  to: string;
  value: string;
  block?: string;
  nonce?: number;
  confirmations?: number;
  networkName?: string;
  tokenSymbol?: string;
}[]

/** Search tokens by keyword, symbol, or address */
export interface TokenSearchInput {
  /** Search keyword (symbol, name, or address) */
  query: string;
  /** Chain alias (eth, bsc, polygon) or networkId (evm--1, evm--56) */
  chain?: string;
  /** Max results (default 10) */
  limit?: number;
}

export type TokenSearchOutput = ({
  contractAddress: string;
  symbol: string;
  name: string | null;
  decimals: number;
  price: string | null;
  networkId: string;
  logoUrl: string | null;
  isNative: boolean;
  liquidity: string | null;
  marketCap: string | null;
  communityRecognized: boolean;
})[]

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
  logoUrl: string | null;
  price: string | null;
  marketCap: string | null;
  fdv: string | null;
  tvl: string | null;
  liquidity: string | null;
  circulatingSupply: string | null;
  holders: number | null;
  priceChange1hPercent: string | null;
  priceChange4hPercent: string | null;
  priceChange24hPercent: string | null;
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
  price: string | null;
  priceChange1mPercent: string | null;
  priceChange5mPercent: string | null;
  priceChange1hPercent: string | null;
  priceChange4hPercent: string | null;
  priceChange24hPercent: string | null;
}

/** Top trending tokens across chains */
export interface TokenTrendingInput {
  /** Chain alias (eth, bsc, polygon) or networkId (evm--1, evm--56) */
  chain?: string;
  limit?: number;
}

export type TokenTrendingOutput = ({
  symbol: string;
  name: string | null;
  contractAddress: string;
  networkId: string;
  price: string | null;
  priceChange24hPercent: string | null;
  marketCap: string | null;
  logoUrl: string | null;
  isNative: boolean;
  communityRecognized: boolean;
})[]

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
      trades: string | null;
      buys: string | null;
      sells: string | null;
      volume: string | null;
      vBuy: string | null;
      vSell: string | null;
      uniqueWallets: string | null;
    };
    '5m': {
      trades: string | null;
      buys: string | null;
      sells: string | null;
      volume: string | null;
      vBuy: string | null;
      vSell: string | null;
      uniqueWallets: string | null;
    };
    '1h': {
      trades: string | null;
      buys: string | null;
      sells: string | null;
      volume: string | null;
      vBuy: string | null;
      vSell: string | null;
      uniqueWallets: string | null;
    };
    '4h': {
      trades: string | null;
      buys: string | null;
      sells: string | null;
      volume: string | null;
      vBuy: string | null;
      vSell: string | null;
      uniqueWallets: string | null;
    };
    '24h': {
      trades: string | null;
      buys: string | null;
      sells: string | null;
      volume: string | null;
      vBuy: string | null;
      vSell: string | null;
      uniqueWallets: string | null;
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

export type TokenLiquidityOutput = ({
  accountAddress: string;
  amount: string;
  fiatValue: string;
  percentage: string | null;
})[]

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
  price: string | null;
  priceChange1mPercent: string | null;
  priceChange5mPercent: string | null;
  priceChange1hPercent: string | null;
  priceChange4hPercent: string | null;
  priceChange24hPercent: string | null;
}

/** Batch pricing for multiple tokens */
export interface MarketPricesInput {
  /** Comma-separated chain:address pairs (e.g. "eth:0x...,bsc:0x...") */
  tokens: string;
}

export type MarketPricesOutput = ({
  symbol: string;
  contractAddress: string;
  networkId: string;
  price: string | null;
  priceChange24hPercent: string | null;
})[]

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

export type MarketKlineOutput = {
  /** Open price */
  o: number;
  /** High price */
  h: number;
  /** Low price */
  l: number;
  /** Close price */
  c: number;
  /** Volume */
  v: number;
  /** Timestamp (seconds) */
  t: number;
}[]

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
  quotes: ({
    provider: string;
    providerName: string;
    toAmount: string | null;
    fromAmount: string | null;
    minToAmount: string | null;
    estimatedTime: string | null;
    instantRate: string | null;
    isBest: boolean;
    fee: string | null;
    errorMessage?: string;
    allowanceResult?: {
      allowanceTarget: string;
      amount: string;
      shouldResetApprove?: boolean;
    } | null;
  })[];
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
    walletAddress: string | null;
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

export type SwapNetworksOutput = {
  networkId: string;
  name: string;
  chainId: string;
  nativeSymbol: string;
  supportSingleSwap: boolean;
  supportCrossChainSwap: boolean;
  supportLimit: boolean;
}[]

/** Local swap order history */
export interface SwapHistoryInput {}

export type SwapHistoryOutput = ({
  orderId: string;
  status: string;
  chain: string;
  from: string | null;
  to: string | null;
  amount: string;
  txHash: string | null;
  provider: string | null;
  createdAt: number;
  updatedAt: number;
})[]

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
  type: string | null;
  display?: unknown;
  parsedTx?: unknown | null;
  accountAddress: string;
  isConfirmationRequired: boolean;
}
