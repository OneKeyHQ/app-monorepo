// Type conversion utilities between SDK types and OneKey formats
// Provides clean conversion functions to minimize code duplication

import type {
  IHLPerpsClearinghouseState,
  IHLSpotClearinghouseState,
  IHLAssetPosition,
  IHLOrder,
  IHLFrontendOrder,
  IHLFill,
  IHLUserFees,
  IHLOrderParams,
  IHLOrderRequest,
  IHLCancelRequest,
  IHLCancelByCloidRequest,
  IHLOrderResponse,
  IHLCancelResponse,
  IHLTwapOrderResponse,
  IHLAllMids,
  IHLBook,
  IHLCandle,
  IHLSpotBalance,
  IHLPortfolio,
  IHLReferral,
  IHLUserRole,
  IHLUserRateLimit,
  IHLActiveAssetData,
  IHLTIF,
  IHLHex,
} from './sdk';

import type {
  IHLAccountSummary,
  IHLUserState,
  IHLPosition,
  IHLOpenOrder,
  IHLBalance,
  IHLMarginSummary,
  IHLPortfolioSummary,
  IHLTradeHistory,
} from './account';

import type {
  IHLPlaceOrderRequest,
  IHLCancelOrderRequest,
  IHLOrderResult,
  IHLCancelResult,
  IHLTwapResult,
  IPerpOrderSide,
  IHLOrderTiming,
} from './api';

// =============================================================================
// Result wrapper for all conversion operations
// =============================================================================

export interface IConversionResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly warnings?: string[];
  readonly timestamp: number;
}

export namespace PerpConverters {
  
  // =============================================================================
  // Account Data Converters
  // =============================================================================

  export function convertAccountSummary(
    sdkState: IHLPerpsClearinghouseState
  ): IConversionResult<IHLAccountSummary> {
    try {
      const summary: IHLAccountSummary = {
        accountValue: sdkState.marginSummary.accountValue,
        totalMarginUsed: sdkState.marginSummary.totalMarginUsed,
        withdrawable: sdkState.withdrawable,
        totalNtlPos: sdkState.marginSummary.totalNtlPos,
        totalUnrealizedPnl: calculateTotalUnrealizedPnl(sdkState.assetPositions),
        totalRealizedPnl: '0', // Will be calculated from trading history
        freeMargin: calculateFreeMargin(sdkState.marginSummary),
        marginRatio: calculateMarginRatio(sdkState.marginSummary),
        crossMaintenanceMarginUsed: sdkState.crossMaintenanceMarginUsed,
        lastUpdate: sdkState.time,
      };

      return {
        success: true,
        data: summary,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to convert account summary: ${error}`,
        timestamp: Date.now(),
      };
    }
  }

  export function convertPosition(
    sdkPosition: IHLAssetPosition,
    markPrice?: string
  ): IConversionResult<IHLPosition> {
    try {
      const pos = sdkPosition.position;
      const szi = parseFloat(pos.szi);
      
      const position: IHLPosition = {
        coin: pos.coin,
        side: szi > 0 ? 'long' : 'short',
        size: Math.abs(szi).toString(),
        entryPrice: pos.entryPx,
        markPrice: markPrice || '0',
        unrealizedPnl: pos.unrealizedPnl,
        leverage: {
          type: pos.leverage.type,
          value: pos.leverage.value,
          rawUsd: pos.leverage.type === 'isolated' ? pos.leverage.rawUsd : undefined,
        },
        marginUsed: pos.marginUsed,
        liquidationPrice: pos.liquidationPx,
        positionValue: pos.positionValue,
        returnOnEquity: pos.returnOnEquity,
        maxLeverage: pos.maxLeverage,
        cumFunding: {
          allTime: pos.cumFunding.allTime,
          sinceOpen: pos.cumFunding.sinceOpen,
          sinceChange: pos.cumFunding.sinceChange,
        },
        lastUpdate: Date.now(),
      };

      return {
        success: true,
        data: position,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to convert position: ${error}`,
        timestamp: Date.now(),
      };
    }
  }

  export function convertOrder(
    sdkOrder: IHLOrder | IHLFrontendOrder
  ): IConversionResult<IHLOpenOrder> {
    try {
      const order: IHLOpenOrder = {
        orderId: sdkOrder.oid,
        coin: sdkOrder.coin,
        side: sdkOrder.side,
        orderType: determineOrderType(sdkOrder),
        size: sdkOrder.sz,
        origSize: sdkOrder.origSz,
        price: sdkOrder.limitPx,
        timestamp: sdkOrder.timestamp,
        reduceOnly: sdkOrder.reduceOnly || false,
        cloid: sdkOrder.cloid || undefined,
        status: 'open', // Default status, should be determined by context
      };

      // Create a new object with additional properties for frontend orders
      let extendedOrder = { ...order };
      
      if ('triggerPx' in sdkOrder) {
        extendedOrder = { ...extendedOrder, triggerPrice: sdkOrder.triggerPx };
      }

      if ('tif' in sdkOrder && sdkOrder.tif) {
        extendedOrder = { ...extendedOrder, tif: sdkOrder.tif };
      }

      return {
        success: true,
        data: extendedOrder,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to convert order: ${error}`,
        timestamp: Date.now(),
      };
    }
  }

  export function convertSpotBalance(
    sdkBalance: IHLSpotBalance
  ): IConversionResult<IHLSpotBalance> {
    try {
      const balance = {
        ...sdkBalance,
        available: (parseFloat(sdkBalance.total) - parseFloat(sdkBalance.hold)).toString(),
      };

      return {
        success: true,
        data: balance,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to convert spot balance: ${error}`,
        timestamp: Date.now(),
      };
    }
  }

  export function convertUserFees(
    sdkFees: IHLUserFees
  ): IConversionResult<IHLUserFees> {
    try {
      // Return SDK fees as-is since we're using the SDK type
      return {
        success: true,
        data: sdkFees,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to convert user fees: ${error}`,
        timestamp: Date.now(),
      };
    }
  }

  export function convertFill(
    sdkFill: IHLFill
  ): IConversionResult<IHLTradeHistory> {
    try {
      const trade: IHLTradeHistory = {
        tradeId: sdkFill.tid,
        orderId: sdkFill.oid,
        coin: sdkFill.coin,
        side: sdkFill.side,
        size: sdkFill.sz,
        price: sdkFill.px,
        fee: sdkFill.fee,
        realizedPnl: sdkFill.closedPnl,
        timestamp: sdkFill.time,
        isMaker: !sdkFill.crossed,
        liquidation: !!sdkFill.liquidation,
      };

      return {
        success: true,
        data: trade,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to convert fill: ${error}`,
        timestamp: Date.now(),
      };
    }
  }

  // =============================================================================
  // Order Request Converters
  // =============================================================================

  export function convertToSDKOrderParams(
    request: IHLPlaceOrderRequest,
    assetId: number
  ): IConversionResult<IHLOrderParams> {
    try {
      const isBuy = request.side === 'buy';
      
      // Determine order type and TIF
      let orderType: IHLOrderParams['t'];
      if (request.price.priceType === 'market') {
        orderType = { limit: { tif: 'Ioc' } };
      } else if (request.price.priceType === 'trigger' && request.price.triggerPrice) {
        orderType = {
          trigger: {
            isMarket: false,
            triggerPx: request.price.triggerPrice,
            tpsl: determineTpSl(request),
          },
        };
      } else {
        orderType = { limit: { tif: convertTIF(request.timing.tif) } };
      }

      const orderParams: IHLOrderParams = {
        a: assetId,
        b: isBuy,
        p: request.price.price,
        s: request.size.size,
        r: request.timing.reduceOnly || false,
        t: orderType,
        c: request.clientOrderId ? (`0x${request.clientOrderId}` as IHLHex) : undefined,
      };

      return {
        success: true,
        data: orderParams,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to convert order params: ${error}`,
        timestamp: Date.now(),
      };
    }
  }

  export function convertOrderResponse(
    sdkResponse: IHLOrderResponse
  ): IConversionResult<IHLOrderResult> {
    try {
      const status = sdkResponse.response.data.statuses[0];
      
      if ('error' in status) {
        const result: IHLOrderResult = {
          success: false,
          status: 'rejected',
          error: status.error,
          timestamp: Date.now(),
        };
        return { success: true, data: result, timestamp: Date.now() };
      }

      if ('resting' in status) {
        const result: IHLOrderResult = {
          success: true,
          orderId: status.resting.oid,
          clientOrderId: status.resting.cloid?.replace('0x', ''),
          status: 'placed',
          timestamp: Date.now(),
        };
        return { success: true, data: result, timestamp: Date.now() };
      }

      if ('filled' in status) {
        const result: IHLOrderResult = {
          success: true,
          orderId: status.filled.oid,
          clientOrderId: status.filled.cloid?.replace('0x', ''),
          status: 'filled',
          filledSize: status.filled.totalSz,
          averagePrice: status.filled.avgPx,
          timestamp: Date.now(),
        };
        return { success: true, data: result, timestamp: Date.now() };
      }

      return {
        success: false,
        error: 'Unknown order response format',
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to convert order response: ${error}`,
        timestamp: Date.now(),
      };
    }
  }

  export function convertCancelResponse(
    sdkResponse: IHLCancelResponse
  ): IConversionResult<IHLCancelResult> {
    try {
      const statuses = sdkResponse.response.data.statuses;
      const successCount = statuses.filter(s => s === 'success').length;
      const failureCount = statuses.length - successCount;
      const errors = statuses
        .filter(s => typeof s === 'object' && 'error' in s)
        .map(s => (s as { error: string }).error);

      const result: IHLCancelResult = {
        success: successCount > 0,
        canceledOrders: successCount,
        failedCancels: failureCount,
        canceledOrderIds: [], // Would need to be tracked from the original request
        errors,
        timestamp: Date.now(),
      };

      return {
        success: true,
        data: result,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to convert cancel response: ${error}`,
        timestamp: Date.now(),
      };
    }
  }

  // =============================================================================
  // Market Data Converters
  // =============================================================================

  export function convertAllMids(
    sdkMids: IHLAllMids
  ): IConversionResult<Record<string, string>> {
    try {
      const mids: Record<string, string> = {};
      
      if (sdkMids && typeof sdkMids === 'object') {
        Object.keys(sdkMids).forEach(key => {
          const value = (sdkMids as any)[key];
          if (typeof value === 'string') {
            mids[key] = value;
          }
        });
      }

      return {
        success: true,
        data: mids,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to convert all mids: ${error}`,
        timestamp: Date.now(),
      };
    }
  }

  export function convertOrderBook(
    sdkBook: IHLBook
  ): IConversionResult<{
    coin: string;
    timestamp: number;
    bids: Array<{ price: string; size: string; count: number }>;
    asks: Array<{ price: string; size: string; count: number }>;
  }> {
    try {
      const orderBook = {
        coin: sdkBook.coin,
        timestamp: sdkBook.time,
        bids: sdkBook.levels[0].map(level => ({
          price: level.px,
          size: level.sz,
          count: level.n,
        })),
        asks: sdkBook.levels[1].map(level => ({
          price: level.px,
          size: level.sz,
          count: level.n,
        })),
      };

      return {
        success: true,
        data: orderBook,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to convert order book: ${error}`,
        timestamp: Date.now(),
      };
    }
  }

  // =============================================================================
  // Batch Conversion Functions
  // =============================================================================

  export function convertPositions(
    sdkPositions: IHLAssetPosition[],
    markPrices?: Record<string, string>
  ): IConversionResult<IHLPosition[]> {
    try {
      const positions: IHLPosition[] = [];
      const warnings: string[] = [];

      for (const sdkPosition of sdkPositions) {
        const markPrice = markPrices?.[sdkPosition.position.coin];
        const result = convertPosition(sdkPosition, markPrice);
        
        if (result.success && result.data) {
          positions.push(result.data);
        } else {
          warnings.push(`Failed to convert position for ${sdkPosition.position.coin}: ${result.error}`);
        }
      }

      return {
        success: true,
        data: positions,
        warnings: warnings.length > 0 ? warnings : undefined,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to convert positions: ${error}`,
        timestamp: Date.now(),
      };
    }
  }

  export function convertOrders(
    sdkOrders: (IHLOrder | IHLFrontendOrder)[]
  ): IConversionResult<IHLOpenOrder[]> {
    try {
      const orders: IHLOpenOrder[] = [];
      const warnings: string[] = [];

      for (const sdkOrder of sdkOrders) {
        const result = convertOrder(sdkOrder);
        
        if (result.success && result.data) {
          orders.push(result.data);
        } else {
          warnings.push(`Failed to convert order ${sdkOrder.oid}: ${result.error}`);
        }
      }

      return {
        success: true,
        data: orders,
        warnings: warnings.length > 0 ? warnings : undefined,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to convert orders: ${error}`,
        timestamp: Date.now(),
      };
    }
  }

  // =============================================================================
  // API Conversion Functions (moved from api.ts)
  // =============================================================================

  export function toSDKOrderRequest(request: IHLPlaceOrderRequest, assetId: number): IConversionResult<IHLOrderRequest> {
    const orderParamsResult = convertToSDKOrderParams(request, assetId);
    if (!orderParamsResult.success || !orderParamsResult.data) {
      return {
        success: false,
        error: orderParamsResult.error,
        timestamp: Date.now(),
      };
    }
    
    try {
      const sdkRequest: IHLOrderRequest = {
        action: {
          type: 'order',
          orders: [orderParamsResult.data],
          grouping: 'na',
        },
        nonce: Date.now(),
        signature: {
          r: '0x0' as IHLHex,
          s: '0x0' as IHLHex,
          v: 27,
        }, // Will be filled by signing service
      };

      return {
        success: true,
        data: sdkRequest,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to convert to SDK order request: ${error}`,
        timestamp: Date.now(),
      };
    }
  }

  export function toSDKCancelRequest(request: IHLCancelOrderRequest, assetId: number): IConversionResult<IHLCancelRequest | IHLCancelByCloidRequest> {
    try {
      if (request.clientOrderId) {
        const cancelByCloidRequest: IHLCancelByCloidRequest = {
          action: {
            type: 'cancelByCloid',
            cancels: [{
              asset: assetId,
              cloid: `0x${request.clientOrderId}` as IHLHex,
            }],
          },
          nonce: Date.now(),
          signature: {
            r: '0x0' as IHLHex,
            s: '0x0' as IHLHex,
            v: 27,
          },
        };
        
        return {
          success: true,
          data: cancelByCloidRequest,
          timestamp: Date.now(),
        };
      }

      const cancelRequest: IHLCancelRequest = {
        action: {
          type: 'cancel',
          cancels: [{
            a: assetId,
            o: request.orderId!,
          }],
        },
        nonce: Date.now(),
        signature: {
          r: '0x0' as IHLHex,
          s: '0x0' as IHLHex,
          v: 27,
        },
      };

      return {
        success: true,
        data: cancelRequest,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to convert cancel request: ${error}`,
        timestamp: Date.now(),
      };
    }
  }

  // =============================================================================
  // Account Conversion Functions (moved from account.ts)
  // =============================================================================

  export function convertFromSDKClearinghouse(
    state: IHLPerpsClearinghouseState
  ): IConversionResult<IHLAccountSummary> {
    try {
      const summary: IHLAccountSummary = {
        accountValue: state.marginSummary.accountValue,
        totalMarginUsed: state.marginSummary.totalMarginUsed,
        withdrawable: state.withdrawable,
        totalNtlPos: state.marginSummary.totalNtlPos,
        totalUnrealizedPnl: calculateTotalUnrealizedPnl(state.assetPositions),
        totalRealizedPnl: '0', // Will be calculated from trading history
        freeMargin: calculateFreeMargin(state.marginSummary),
        marginRatio: calculateMarginRatio(state.marginSummary),
        crossMaintenanceMarginUsed: state.crossMaintenanceMarginUsed,
        lastUpdate: state.time,
      };

      return {
        success: true,
        data: summary,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to convert clearinghouse state: ${error}`,
        timestamp: Date.now(),
      };
    }
  }

  export function convertFromSDKPosition(position: IHLAssetPosition, markPrice?: string): IConversionResult<IHLPosition> {
    try {
      const pos = position.position;
      const szi = parseFloat(pos.szi);
      
      const convertedPosition: IHLPosition = {
        coin: pos.coin,
        side: szi > 0 ? 'long' : 'short',
        size: Math.abs(szi).toString(),
        entryPrice: pos.entryPx,
        markPrice: markPrice || '0',
        unrealizedPnl: pos.unrealizedPnl,
        leverage: {
          type: pos.leverage.type,
          value: pos.leverage.value,
          rawUsd: pos.leverage.type === 'isolated' ? pos.leverage.rawUsd : undefined,
        },
        marginUsed: pos.marginUsed,
        liquidationPrice: pos.liquidationPx,
        positionValue: pos.positionValue,
        returnOnEquity: pos.returnOnEquity,
        maxLeverage: pos.maxLeverage,
        cumFunding: {
          allTime: pos.cumFunding.allTime,
          sinceOpen: pos.cumFunding.sinceOpen,
          sinceChange: pos.cumFunding.sinceChange,
        },
        lastUpdate: Date.now(),
      };

      return {
        success: true,
        data: convertedPosition,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to convert position: ${error}`,
        timestamp: Date.now(),
      };
    }
  }

  // =============================================================================
  // Helper Functions
  // =============================================================================

  function calculateTotalUnrealizedPnl(positions: IHLAssetPosition[]): string {
    return positions
      .reduce((total, pos) => total + parseFloat(pos.position.unrealizedPnl), 0)
      .toString();
  }

  function calculateFreeMargin(marginSummary: IHLPerpsClearinghouseState['marginSummary']): string {
    const accountValue = parseFloat(marginSummary.accountValue);
    const marginUsed = parseFloat(marginSummary.totalMarginUsed);
    return Math.max(0, accountValue - marginUsed).toString();
  }

  function calculateMarginRatio(marginSummary: IHLPerpsClearinghouseState['marginSummary']): string {
    const accountValue = parseFloat(marginSummary.accountValue);
    const marginUsed = parseFloat(marginSummary.totalMarginUsed);
    if (accountValue === 0) return '0';
    return (marginUsed / accountValue).toString();
  }

  function determineOrderType(order: IHLOrder | IHLFrontendOrder): string {
    if ('orderType' in order) {
      return order.orderType;
    }
    return 'Limit'; // Default for basic orders
  }

  function convertTIF(tif: IHLOrderTiming['tif']): IHLTIF {
    switch (tif) {
      case 'GTC': return 'Gtc';
      case 'IOC': return 'Ioc';
      case 'ALO': return 'Alo';
      case 'FOK': return 'Ioc'; // FOK not directly supported, fallback to IOC
      default: return 'Gtc';
    }
  }

  function determineTpSl(request: IHLPlaceOrderRequest): 'tp' | 'sl' {
    const strategy = request.metadata?.strategy;
    if (strategy === 'take_profit') return 'tp';
    if (strategy === 'stop_loss') return 'sl';
    
    // Try to infer from price relationships
    const triggerPrice = parseFloat(request.price.triggerPrice || '0');
    const currentPrice = parseFloat(request.price.price);
    
    if (request.side === 'sell') {
      return triggerPrice > currentPrice ? 'tp' : 'sl';
    } else {
      return triggerPrice < currentPrice ? 'tp' : 'sl';
    }
  }
}

// =============================================================================
// Validation Helpers
// =============================================================================

export namespace ConversionValidators {
  export function validateOrderRequest(request: IHLPlaceOrderRequest): string[] {
    const errors: string[] = [];

    if (!request.coin || request.coin.trim() === '') {
      errors.push('Coin symbol is required');
    }

    if (!request.size.size || parseFloat(request.size.size) <= 0) {
      errors.push('Order size must be positive');
    }

    if (request.price.priceType === 'limit' && (!request.price.price || parseFloat(request.price.price) <= 0)) {
      errors.push('Limit price must be positive');
    }

    if (request.price.priceType === 'trigger' && (!request.price.triggerPrice || parseFloat(request.price.triggerPrice) <= 0)) {
      errors.push('Trigger price must be positive');
    }

    if (request.clientOrderId && request.clientOrderId.length > 32) {
      errors.push('Client order ID too long (max 32 characters)');
    }

    return errors;
  }

  export function validateConversionResult<T>(result: IConversionResult<T>): boolean {
    return result.success && !!result.data;
  }
}
