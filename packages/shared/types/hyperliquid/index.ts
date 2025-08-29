// Unified export file for Hyperliquid Perps types
// Provides a clean and organized interface for all type definitions

// =============================================================================
// SDK Types - Direct re-exports from Hyperliquid SDK
// =============================================================================

export type {
  // Core client types
  IHLInfoClient,
  IHLExchangeClient,
  IHLSubscriptionClient,
  IHLHttpTransport,
  IHLWebSocketTransport,

  // Basic data types
  IHLHex,
  IHLSignature,

  // Order types
  IHLOrderParams,
  IHLOrder,
  IHLFrontendOrder,
  IHLOrderStatus,
  IHLOrderProcessingStatus,
  IHLOrderType,
  IHLOrderLookup,
  IHLTIF,

  // Trading types
  IHLFill,
  IHLFillLiquidation,
  IHLBook,
  IHLBookLevel,

  // TWAP types
  IHLTwapHistory,
  IHLTwapState,
  IHLTwapStatus,
  IHLTwapSliceFill,

  // Account types
  IHLPerpsClearinghouseState,
  IHLSpotClearinghouseState,
  IHLAssetPosition,
  IHLActiveAssetData,
  IHLSpotBalance,
  IHLEvmEscrowsBalance,

  // User types
  IHLUserFees,
  IHLUserRole,
  IHLUserRateLimit,
  IHLUserFundingUpdate,
  IHLUserNonFundingLedgerUpdate,
  IHLFundingUpdate,
  IHLSubAccount,
  IHLPortfolio,
  IHLPortfolioPeriods,
  IHLReferral,
  IHLExtraAgent,
  IHLMultiSigSigners,
  IHLLegalCheck,
  IHLPreTransferCheck,

  // Request types
  IHLOrderRequest,
  IHLCancelRequest,
  IHLCancelByCloidRequest,
  IHLModifyRequest,
  IHLBatchModifyRequest,
  IHLTwapOrderRequest,
  IHLTwapCancelRequest,
  IHLUpdateLeverageRequest,
  IHLUpdateIsolatedMarginRequest,
  IHLApproveAgentRequest,
  IHLApproveBuilderFeeRequest,
  IHLUsdSendRequest,
  IHLWithdraw3Request,
  IHLUsdClassTransferRequest,
  IHLSpotSendRequest,
  IHLVaultTransferRequest,
  IHLCreateVaultRequest,
  IHLVaultModifyRequest,
  IHLVaultDistributeRequest,
  IHLSubAccountTransferRequest,
  IHLSubAccountSpotTransferRequest,
  IHLCreateSubAccountRequest,
  IHLSubAccountModifyRequest,
  IHLSetReferrerRequest,
  IHLRegisterReferrerRequest,
  IHLClaimRewardsRequest,
  IHLSetDisplayNameRequest,
  IHLTokenDelegateRequest,
  IHLCDepositRequest,
  IHLCWithdrawRequest,
  IHLScheduleCancelRequest,
  IHLReserveRequestWeightRequest,
  IHLEvmUserModifyRequest,
  IHLSpotUserRequest,

  // Response types
  IHLOrderResponse,
  IHLOrderSuccessResponse,
  IHLCancelResponse,
  IHLCancelSuccessResponse,
  IHLTwapOrderResponse,
  IHLTwapOrderSuccessResponse,
  IHLTwapCancelResponse,
  IHLTwapCancelSuccessResponse,
  IHLSuccessResponse,
  IHLErrorResponse,
  IHLCreateVaultResponse,
  IHLCreateSubAccountResponse,

  // WebSocket types
  IHLWsAllMids,
  IHLWsWebData2,
  IHLWsUserEvent,
  IHLWsUserFundings,
  IHLWsUserNonFundingLedgerUpdates,
  IHLWsBbo,
  IHLWsNotification,
  IHLWsTrade,
  IHLWsActiveAssetCtx,
  IHLWsActiveSpotAssetCtx,

  // Market data types
  IHLAllMids,
  IHLCandle,
  IHLPerpsMeta,
  IHLSpotMeta,
  IHLPerpsMetaAndAssetCtxs,
  IHLSpotMetaAndAssetCtxs,

  // Union types
  IHLExchangeRequest,
  IHLExchangeResponse,
  IHLWebSocketData,

  // Utility types
  IHLOrderSide,
  IHLAssetSymbol,
  IHLOrderId,
  IHLClientOrderId,
  IHLPrice,
  IHLSize,
  IHLTimestamp,
} from './sdk';

// SDK type guards
export {
  isOrderResponse,
  isErrorResponse,
} from './sdk';

// =============================================================================
// Account Types - OneKey format for user information and state
// =============================================================================

export type {
  // Core account types
  IHLAccountSummary,
  IHLUserState,
  IHLMarginSummary,
  IHLCrossMarginSummary,

  // Position types
  IHLPosition,
  IHLLeverageInfo,
  IHLCumulativeFunding,
  IHLPositionSummary,
  IHLRiskMetrics,

  // Order types
  IHLOpenOrder,

  // Balance types
  IHLBalance,

  // Fee types
  IHLDailyVolume,

  // Portfolio types
  IHLPortfolioSummary,
  IHLPortfolioPositions,
  IHLPortfolioOrders,
  IHLPortfolioRisk,
  IHLPortfolioPerformance,

  // Account management types
  IHLAccountSettings,
  IHLTradingRestrictions,

  // History types
  IHLAccountHistory,
  IHLTradeHistory,
  IHLTransferHistory,
  IHLFundingHistory,
  IHLLiquidationHistory,
} from './account';

// Account converters (moved to PerpConverters in converters.ts)

// Account type guards
export {
  isPerpPosition,
  isPerpOpenOrder,
  isPerpBalance,
} from './account';

// =============================================================================
// API Types - Trading operations and requests
// =============================================================================

export type {
  // Core trading types
  IPerpOrderSide,
  IHLOrderSize,
  IHLOrderPrice,
  IHLOrderTiming,

  // Order request types
  IHLPlaceOrderRequest,
  IHLOrderMetadata,
  IHLCancelOrderRequest,
  IHLModifyOrderRequest,
  IHLBatchOrderRequest,

  // Advanced order types
  IHLTPSLOrderRequest,

  // Position management types
  IHLLeverageUpdateRequest,
  IHLMarginUpdateRequest,
  IHLPositionCloseRequest,

  // Transfer types
  IHLTransferRequest,
  IHLInternalTransferRequest,

  // Response types
  IHLOrderResult,
  IHLBatchOrderResult,
  IHLCancelResult,
  IHLTwapResult,
  IHLTransferResult,

  // Validation types
  IHLOrderValidation,
  IHLTradingLimits,

  // Builder pattern type
  IHLOrderBuilder,

  // Error types
  IHLApiError,
  IHLRateLimitInfo,

  // Configuration types
  IHLApiConfig,
} from './api';

// =============================================================================
// Market Types - UI and trading components
// =============================================================================

export type {
  // Token list types
  IHLTokenListItem,
  IHLTokenSelectorItem,
  
  // Market summary types
  IHLMarketSummary,
  
  // Ticker bar types
  IHLTickerItem,
  IHLTickerBarData,
  
  // Trading pair types
  IHLTradingPair,
  
  // Market stats types
  IHLMarketStats,
  
  // Price alert types
  IHLPriceAlert,
  
  // Watchlist types
  IHLWatchlistItem,
  IHLWatchlist,
  
  // Heat map types
  IHLHeatMapItem,
  IHLHeatMapData,
  
  // Trading view types
  IHLTradingViewConfig,
  
  // Market filter types
  IHLMarketFilter,
  
  // Market news types
  IHLMarketNews,
} from './market';

// Market type guards
export {
  isHLTokenListItem,
  isHLMarketStats,
  isHLPriceAlert,
} from './market';

// API converters (moved to PerpConverters in converters.ts)

// API type guards
export {
  isPerpPlaceOrderRequest,
  isPerpOrderResult,
  isPerpCancelOrderRequest,
} from './api';

// =============================================================================
// Conversion Utilities
// =============================================================================

export type {
  IConversionResult,
} from './converters';

export {
  PerpConverters,
  ConversionValidators,
} from './converters';

// =============================================================================
// Common Utility Types (using SDK types)
// =============================================================================

// Using SDK utility types instead of redefining

// Side types with both formats for compatibility
export type IHLSide = 'buy' | 'sell' | 'B' | 'A';
export type IHLPositionSide = 'long' | 'short';

// Common enums
export enum EPerpOrderStatus {
  PENDING = 'pending',
  PLACED = 'placed',
  FILLED = 'filled',
  PARTIALLY_FILLED = 'partially_filled',
  CANCELLED = 'cancelled',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

export enum EPerpOrderType {
  MARKET = 'market',
  LIMIT = 'limit',
  STOP_MARKET = 'stop_market',
  STOP_LIMIT = 'stop_limit',
  TAKE_PROFIT_MARKET = 'take_profit_market',
  TAKE_PROFIT_LIMIT = 'take_profit_limit',
  TWAP = 'twap',
}

export enum EPerpMarginMode {
  CROSS = 'cross',
  ISOLATED = 'isolated',
}

export enum EPerpTransferType {
  DEPOSIT = 'deposit',
  WITHDRAW = 'withdraw',
  SPOT_TO_PERP = 'spot_to_perp',
  PERP_TO_SPOT = 'perp_to_spot',
  INTERNAL = 'internal',
}

// =============================================================================
// Type Guards for Common Types
// =============================================================================

export function isPerpBuyOrder(side: IHLSide): boolean {
  return side === 'buy' || side === 'B';
}

export function isPerpSellOrder(side: IHLSide): boolean {
  return side === 'sell' || side === 'A';
}

export function isPerpLongPosition(side: IHLPositionSide): boolean {
  return side === 'long';
}

export function isPerpShortPosition(side: IHLPositionSide): boolean {
  return side === 'short';
}

export function isValidPerpPrice(price: string): boolean {
  const num = parseFloat(price);
  return !isNaN(num) && num > 0 && isFinite(num);
}

export function isValidPerpSize(size: string): boolean {
  const num = parseFloat(size);
  return !isNaN(num) && num > 0 && isFinite(num);
}

// =============================================================================
// Constants
// =============================================================================

export const PERP_CONSTANTS = {
  // Precision constants
  PRICE_PRECISION: 8,
  SIZE_PRECISION: 8,
  PERCENTAGE_PRECISION: 4,

  // Default values
  DEFAULT_SLIPPAGE: '0.1', // 0.1%
  DEFAULT_TIF: 'GTC' as const,
  MAX_LEVERAGE: 100,
  MIN_ORDER_SIZE: '0.0001',

  // Rate limits
  DEFAULT_RATE_LIMIT: 100,
  BURST_RATE_LIMIT: 300,

  // Timeouts
  DEFAULT_TIMEOUT: 30000, // 30 seconds
  ORDER_TIMEOUT: 10000,   // 10 seconds
  CANCEL_TIMEOUT: 5000,   // 5 seconds

  // WebSocket constants
  WS_RECONNECT_INTERVAL: 5000,
  WS_PING_INTERVAL: 30000,
  WS_MAX_RECONNECT_ATTEMPTS: 5,
} as const;

// =============================================================================
// Validation Schemas (for runtime validation if needed)
// =============================================================================

export const PERP_VALIDATION = {
  ORDER_SIZE_REGEX: /^[0-9]+(\.[0-9]+)?$/,
  PRICE_REGEX: /^[0-9]+(\.[0-9]+)?$/,
  ASSET_SYMBOL_REGEX: /^[A-Z0-9]+$/,
  CLIENT_ORDER_ID_REGEX: /^[a-zA-Z0-9_-]{1,32}$/,
  ADDRESS_REGEX: /^0x[a-fA-F0-9]{40}$/,
} as const;

// =============================================================================
// Error Messages
// =============================================================================

export const PERP_ERROR_MESSAGES = {
  INVALID_ORDER_SIZE: 'Order size must be a positive number',
  INVALID_PRICE: 'Price must be a positive number',
  INVALID_ASSET_SYMBOL: 'Asset symbol must contain only alphanumeric characters',
  INVALID_CLIENT_ORDER_ID: 'Client order ID must be 1-32 characters long and contain only alphanumeric characters, underscores, and hyphens',
  INVALID_ADDRESS: 'Address must be a valid Ethereum address',
  INSUFFICIENT_BALANCE: 'Insufficient balance for this operation',
  POSITION_NOT_FOUND: 'Position not found for the specified asset',
  ORDER_NOT_FOUND: 'Order not found',
  CONVERSION_FAILED: 'Failed to convert data format',
  NETWORK_ERROR: 'Network error occurred',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
  UNAUTHORIZED: 'Unauthorized access',
  SERVER_ERROR: 'Server error occurred',
} as const;
