// API types for Hyperliquid Perps trading operations
// Focuses on trading actions: placing orders, canceling, modifying, etc.

import type {
  IHLOrderParams,
  IHLOrderRequest,
  IHLCancelRequest,
  IHLCancelByCloidRequest,
  IHLModifyRequest,
  IHLBatchModifyRequest,
  IHLTwapOrderRequest,
  IHLTwapCancelRequest,
  IHLUpdateLeverageRequest,
  IHLUpdateIsolatedMarginRequest,
  IHLUsdSendRequest,
  IHLWithdraw3Request,
  IHLUsdClassTransferRequest,
  IHLVaultTransferRequest,
  IHLSubAccountTransferRequest,
  IHLScheduleCancelRequest,
  IHLOrderResponse,
  IHLCancelResponse,
  IHLTwapOrderResponse,
  IHLTwapCancelResponse,
  IHLSuccessResponse,
  IHLErrorResponse,
  IHLTIF,
  IHLOrderType,
  IHLHex,
  IHLSignature,
} from './sdk';

// =============================================================================
// Core Trading Types
// =============================================================================

// Using SDK type for order side
export type IPerpOrderSide = 'buy' | 'sell';

export interface IHLOrderSize {
  readonly size: string;
  readonly notional?: string;
  readonly percentage?: string; // For position percentage orders
}

export interface IHLOrderPrice {
  readonly price: string;
  readonly priceType: 'limit' | 'market' | 'trigger';
  readonly triggerPrice?: string;
  readonly stopPrice?: string;
  readonly takeProfitPrice?: string;
}

export interface IHLOrderTiming {
  readonly tif: 'GTC' | 'IOC' | 'FOK' | 'ALO';
  readonly postOnly?: boolean;
  readonly reduceOnly?: boolean;
  readonly timeInForce?: number; // Custom expiry time
}

// =============================================================================
// Order Request Types
// =============================================================================

export interface IHLPlaceOrderRequest {
  readonly coin: string;
  readonly side: IPerpOrderSide;
  readonly size: IHLOrderSize;
  readonly price: IHLOrderPrice;
  readonly timing: IHLOrderTiming;
  readonly clientOrderId?: string;
  readonly metadata?: IHLOrderMetadata;
}

export interface IHLOrderMetadata {
  readonly strategy?: string;
  readonly tags?: string[];
  readonly source?: string;
  readonly riskLevel?: 'low' | 'medium' | 'high';
  readonly notes?: string;
}

export interface IHLCancelOrderRequest {
  readonly coin: string;
  readonly orderId?: number;
  readonly clientOrderId?: string;
  readonly cancelAll?: boolean;
  readonly cancelByCoin?: boolean;
}

export interface IHLModifyOrderRequest {
  readonly orderId: number;
  readonly clientOrderId?: string;
  readonly newPrice?: string;
  readonly newSize?: string;
  readonly newTif?: IHLOrderTiming['tif'];
}

export interface IHLBatchOrderRequest {
  readonly orders: IHLPlaceOrderRequest[];
  readonly grouping?: 'none' | 'normal_tpsl' | 'position_tpsl';
  readonly maxOrders?: number;
  readonly validateOnly?: boolean;
}

export interface IHLTPSLOrderRequest {
  readonly coin: string;
  readonly positionSide: 'long' | 'short';
  readonly takeProfitPrice?: string;
  readonly stopLossPrice?: string;
  readonly tpOrderType?: 'market' | 'limit';
  readonly slOrderType?: 'market' | 'limit';
  readonly size?: string; // If not specified, closes entire position
  readonly isPositionTPSL?: boolean; // Adjusts with position size
}

// =============================================================================
// Position Management Types
// =============================================================================

export interface IHLLeverageUpdateRequest {
  readonly coin: string;
  readonly leverage: number;
  readonly marginMode: 'cross' | 'isolated';
  readonly validateOnly?: boolean;
}

export interface IHLMarginUpdateRequest {
  readonly coin: string;
  readonly side: 'long' | 'short';
  readonly amount: string;
  readonly operation: 'add' | 'remove';
}

export interface IHLPositionCloseRequest {
  readonly coin: string;
  readonly side?: 'long' | 'short';
  readonly size?: string; // If not specified, closes entire position
  readonly priceType: 'market' | 'limit';
  readonly limitPrice?: string;
  readonly urgency?: 'normal' | 'fast' | 'immediate';
}

// =============================================================================
// Transfer Types
// =============================================================================

export interface IHLTransferRequest {
  readonly type: 'deposit' | 'withdraw' | 'spot_to_perp' | 'perp_to_spot';
  readonly asset: string;
  readonly amount: string;
  readonly destination?: IHLHex;
  readonly memo?: string;
  readonly urgency?: 'normal' | 'fast';
}

export interface IHLInternalTransferRequest {
  readonly fromAccount: 'main' | 'sub';
  readonly toAccount: 'main' | 'sub';
  readonly subAccountId?: string;
  readonly asset: string;
  readonly amount: string;
  readonly description?: string;
}

// =============================================================================
// Response Types
// =============================================================================

export interface IHLOrderResult {
  readonly success: boolean;
  readonly orderId?: number;
  readonly clientOrderId?: string;
  readonly status: 'placed' | 'filled' | 'partially_filled' | 'rejected';
  readonly filledSize?: string;
  readonly averagePrice?: string;
  readonly remainingSize?: string;
  readonly fee?: string;
  readonly error?: string;
  readonly timestamp: number;
}

export interface IHLBatchOrderResult {
  readonly success: boolean;
  readonly results: IHLOrderResult[];
  readonly successCount: number;
  readonly failureCount: number;
  readonly totalOrders: number;
  readonly timestamp: number;
}

export interface IHLCancelResult {
  readonly success: boolean;
  readonly canceledOrders: number;
  readonly failedCancels: number;
  readonly canceledOrderIds: number[];
  readonly errors: string[];
  readonly timestamp: number;
}

export interface IHLTwapResult {
  readonly success: boolean;
  readonly twapId?: number;
  readonly status: 'created' | 'running' | 'completed' | 'canceled' | 'error';
  readonly executedSize?: string;
  readonly remainingSize?: string;
  readonly averagePrice?: string;
  readonly error?: string;
  readonly timestamp: number;
}

export interface IHLTransferResult {
  readonly success: boolean;
  readonly transferId?: string;
  readonly status: 'pending' | 'processing' | 'completed' | 'failed';
  readonly amount: string;
  readonly fee?: string;
  readonly txHash?: IHLHex;
  readonly confirmations?: number;
  readonly estimatedConfirmTime?: number;
  readonly error?: string;
  readonly timestamp: number;
}

// =============================================================================
// Validation Types
// =============================================================================

export interface IHLOrderValidation {
  readonly isValid: boolean;
  readonly errors: string[];
  readonly warnings: string[];
  readonly riskLevel: 'low' | 'medium' | 'high' | 'critical';
  readonly estimatedFee: string;
  readonly estimatedSlippage?: string;
  readonly marginRequired: string;
  readonly liquidationPrice?: string;
  readonly suggestions?: string[];
}

export interface IHLTradingLimits {
  readonly maxOrderSize: string;
  readonly maxPositionSize: string;
  readonly maxLeverage: number;
  readonly maxDailyVolume: string;
  readonly minOrderSize: string;
  readonly minPrice: string;
  readonly maxPrice: string;
  readonly allowedOrderTypes: string[];
  readonly tradingHours?: {
    readonly start: string;
    readonly end: string;
    readonly timezone: string;
  };
}

// =============================================================================
// Builder Pattern Types
// =============================================================================

export interface IHLOrderBuilder {
  coin(symbol: string): IHLOrderBuilder;
  buy(size: string): IHLOrderBuilder;
  sell(size: string): IHLOrderBuilder;
  limit(price: string): IHLOrderBuilder;
  market(): IHLOrderBuilder;
  stopLoss(price: string): IHLOrderBuilder;
  takeProfit(price: string): IHLOrderBuilder;
  tif(timeInForce: IHLOrderTiming['tif']): IHLOrderBuilder;
  postOnly(): IHLOrderBuilder;
  reduceOnly(): IHLOrderBuilder;
  clientId(id: string): IHLOrderBuilder;
  metadata(data: IHLOrderMetadata): IHLOrderBuilder;
  build(): IHLPlaceOrderRequest;
}

// =============================================================================
// Conversion Utilities - Moved to converters.ts
// =============================================================================

// NOTE: Conversion utilities have been consolidated into converters.ts to avoid duplication

// =============================================================================
// Type Guards
// =============================================================================

export function isPerpPlaceOrderRequest(request: any): request is IHLPlaceOrderRequest {
  return (
    request &&
    typeof request.coin === 'string' &&
    typeof request.side === 'string' &&
    ['buy', 'sell'].includes(request.side) &&
    request.size &&
    request.price &&
    request.timing
  );
}

export function isPerpOrderResult(result: any): result is IHLOrderResult {
  return (
    result &&
    typeof result.success === 'boolean' &&
    typeof result.timestamp === 'number'
  );
}

export function isPerpCancelOrderRequest(request: any): request is IHLCancelOrderRequest {
  return (
    request &&
    typeof request.coin === 'string' &&
    (typeof request.orderId === 'number' || typeof request.clientOrderId === 'string')
  );
}

// =============================================================================
// Error Types
// =============================================================================

export interface IHLApiError {
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, any>;
  readonly retryable: boolean;
  readonly category: 'validation' | 'network' | 'server' | 'rate_limit' | 'authentication';
}

export interface IHLRateLimitInfo {
  readonly remaining: number;
  readonly resetTime: number;
  readonly limit: number;
  readonly retryAfter?: number;
}

// =============================================================================
// Configuration Types
// =============================================================================

export interface IHLApiConfig {
  readonly baseUrl: string;
  readonly timeout: number;
  readonly retryAttempts: number;
  readonly retryDelay: number;
  readonly rateLimit: IHLRateLimitInfo;
  readonly defaultSlippage: string;
  readonly maxBatchSize: number;
  readonly validateOrders: boolean;
  readonly autoRetry: boolean;
}
