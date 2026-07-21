// cspell: words unifold Unifold hypercore Hypercore
// Types for the Unifold deposit API proxied by the OneKey wallet service.
// Contract: docs/unifold-deposit-app-integration.md (v1.1).
// All amount fields are strings end-to-end; never convert to Number for math.

export type IUnifoldExecutionStatus =
  | 'waiting'
  | 'pending'
  | 'delayed'
  | 'succeeded'
  | 'failed'
  | 'refunded';

export const UNIFOLD_TERMINAL_STATUSES: IUnifoldExecutionStatus[] = [
  'succeeded',
  'failed',
  'refunded',
];

// Nullability is pinned by contract v1.1 §2.3 (G7): every field other than
// executionId/status/terminal/destinationTransactionHashes may be null.
export interface IUnifoldDepositExecution {
  executionId: string;
  status: IUnifoldExecutionStatus;
  terminal: boolean;
  destinationTransactionHashes: string[];
  vendorStatus: string | null;
  recipientAddress: string | null;
  depositWalletId: string | null;
  depositAddress: string | null;
  transactionHash: string | null;
  sourceChainType: string | null;
  sourceChainId: string | null;
  sourceAmountBaseUnit: string | null;
  sourceAmountUsd: string | null;
  sourceCurrency: string | null;
  sourceTokenDecimals: number | null;
  destinationAmountBaseUnit: string | null;
  destinationAmountUsd: string | null;
  destinationCurrency: string | null;
  // v1.2: Amount Received = destinationAmountBaseUnit ÷ 10^decimals
  // (HyperCore USDC (Perp) = 8, Sepolia USDC = 6). Nullable like every other
  // passthrough field; render '—' when absent.
  destinationTokenDecimals: number | null;
  destinationTokenIconUrl: string | null;
  explorerUrl: string | null;
  destinationExplorerUrl: string | null;
  failureReason: string | null;
  createdAt: string | null;
}

export interface IUnifoldDepositDestination {
  destinationChainType: string;
  destinationChainId: string;
  destinationTokenAddress: string;
}

export interface IUnifoldDepositAddressParams extends IUnifoldDepositDestination {
  recipientAddress: string;
  sourceChainType?: string;
}

export interface IUnifoldDepositWallet {
  chainType: string;
  address: string;
  isPrimary: boolean;
}

export interface IUnifoldDepositAddressResult {
  sessionId: string;
  depositAddress: string;
  depositWalletId: string;
  sourceChainType: string;
  wallets: IUnifoldDepositWallet[];
  echo: IUnifoldDepositDestination & { recipientAddress: string };
}

// Vendor catalog passthrough keeps the upstream snake_case field names.
export interface IUnifoldSupportedAssetChain {
  chain_id: string;
  chain_name: string;
  chain_type: string;
  icon_url: string;
  token_address: string;
  decimals: number;
  estimated_price_impact_percent: number;
  max_slippage_percent: number;
  estimated_processing_time: number;
  minimum_deposit_amount_usd: number;
}

export interface IUnifoldSupportedAsset {
  symbol: string;
  name: string;
  icon_url: string;
  is_newly_added: boolean;
  is_stablecoin: boolean;
  chains: IUnifoldSupportedAssetChain[];
}

export interface IUnifoldActivationStatus {
  userExists: boolean;
  activationFee: string;
  isSanctioned: boolean;
  sponsored: boolean;
}

// Wallet-service error codes for this feature (contract v1.1 §2.6).
export const UNIFOLD_ERROR_CODE_FEATURE_DISABLED = 14_101;
export const UNIFOLD_ERROR_CODE_GEO_BLOCKED = 14_102;
