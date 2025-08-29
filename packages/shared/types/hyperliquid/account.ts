// Account and user state types for Hyperliquid Perps
// Focuses on user information, positions, balances, and account management

import type {
  IHLPerpsClearinghouseState,
  IHLSpotClearinghouseState,
  IHLAssetPosition,
  IHLActiveAssetData,
  IHLSpotBalance,
  IHLUserFees,
  IHLUserRole,
  IHLUserRateLimit,
  IHLPortfolio,
  IHLPortfolioPeriods,
  IHLReferral,
  IHLSubAccount,
  IHLExtraAgent,
  IHLMultiSigSigners,
  IHLLegalCheck,
  IHLPreTransferCheck,
  IHLHex,
} from './sdk';

// =============================================================================
// Core Account Types
// =============================================================================

export interface IHLAccountSummary {
  readonly accountValue: string;
  readonly totalMarginUsed: string;
  readonly withdrawable: string;
  readonly totalNtlPos: string;
  readonly totalUnrealizedPnl: string;
  readonly totalRealizedPnl: string;
  readonly freeMargin: string;
  readonly marginRatio: string;
  readonly crossMaintenanceMarginUsed: string;
  readonly lastUpdate: number;
}

export interface IHLUserState {
  readonly address: IHLHex;
  readonly accountSummary: IHLAccountSummary;
  readonly positions: IHLPosition[];
  readonly openOrders: IHLOpenOrder[];
  readonly balances: IHLBalance[];
  readonly marginSummary: IHLMarginSummary;
  readonly fees: IHLUserFees;
  readonly role: IHLUserRole;
  readonly rateLimit: IHLUserRateLimit;
  readonly subAccounts?: IHLSubAccount[];
  readonly portfolio?: IHLPortfolio;
  readonly referral?: IHLReferral;
  readonly extraAgents?: IHLExtraAgent[];
  readonly multiSigConfig?: IHLMultiSigSigners;
  readonly legalCheck?: IHLLegalCheck;
  readonly lastUpdate: number;
}

// =============================================================================
// Position Types
// =============================================================================

export interface IHLPosition {
  readonly coin: string;
  readonly side: 'long' | 'short';
  readonly size: string;
  readonly entryPrice: string;
  readonly markPrice: string;
  readonly unrealizedPnl: string;
  readonly leverage: IHLLeverageInfo;
  readonly marginUsed: string;
  readonly liquidationPrice: string | null;
  readonly positionValue: string;
  readonly returnOnEquity: string;
  readonly maxLeverage: number;
  readonly cumFunding: IHLCumulativeFunding;
  readonly lastUpdate: number;
}

export interface IHLLeverageInfo {
  readonly type: 'isolated' | 'cross';
  readonly value: number;
  readonly rawUsd?: string; // For isolated positions
}

export interface IHLCumulativeFunding {
  readonly allTime: string;
  readonly sinceOpen: string;
  readonly sinceChange: string;
}

export interface IHLPositionSummary {
  readonly totalPositions: number;
  readonly longPositions: number;
  readonly shortPositions: number;
  readonly totalValue: string;
  readonly totalPnl: string;
  readonly totalMarginUsed: string;
  readonly averageROE: string;
  readonly riskMetrics: IHLRiskMetrics;
}

export interface IHLRiskMetrics {
  readonly marginUtilization: string;
  readonly concentrationRisk: string;
  readonly leverageRisk: string;
  readonly liquidationRisk: 'low' | 'medium' | 'high' | 'critical';
  readonly diversificationScore: string;
}

// =============================================================================
// Order Types
// =============================================================================

export interface IHLOpenOrder {
  readonly orderId: number;
  readonly coin: string;
  readonly side: 'B' | 'A';
  readonly orderType: string;
  readonly size: string;
  readonly origSize: string;
  readonly price: string;
  readonly timestamp: number;
  readonly reduceOnly?: boolean;
  readonly cloid?: IHLHex;
  readonly status: 'open' | 'filled' | 'canceled' | 'triggered' | 'rejected';
  readonly triggerPrice?: string;
  readonly tif?: string;
}

// =============================================================================
// Balance Types
// =============================================================================

export interface IHLBalance {
  readonly asset: string;
  readonly total: string;
  readonly available: string;
  readonly locked: string;
  readonly marginUsed?: string;
  readonly unrealizedPnl?: string;
  readonly walletBalance?: string;
}

// Using SDK IHLSpotBalance type instead of redefining

// =============================================================================
// Margin Types
// =============================================================================

export interface IHLMarginSummary {
  readonly accountValue: string;
  readonly totalMarginUsed: string;
  readonly totalNtlPos: string;
  readonly totalRawUsd: string;
  readonly marginRatio: string;
  readonly maintenanceMargin: string;
  readonly initialMargin: string;
  readonly availableMargin: string;
  readonly crossMarginSummary: IHLCrossMarginSummary;
}

export interface IHLCrossMarginSummary {
  readonly accountValue: string;
  readonly totalNtlPos: string;
  readonly totalRawUsd: string;
  readonly totalMarginUsed: string;
}

// =============================================================================
// Fee Types - Using SDK types
// =============================================================================

// Using SDK IHLUserFees type instead of redefining

export interface IHLDailyVolume {
  readonly date: string;
  readonly userCross: string;
  readonly userAdd: string;
  readonly exchange: string;
}

// =============================================================================
// Portfolio Types
// =============================================================================

export interface IHLPortfolioSummary {
  readonly totalValue: string;
  readonly totalPnl: string;
  readonly totalPnlPercent: string;
  readonly dayPnl: string;
  readonly dayPnlPercent: string;
  readonly volume: string;
  readonly positions: IHLPortfolioPositions;
  readonly orders: IHLPortfolioOrders;
  readonly risk: IHLPortfolioRisk;
  readonly performance: IHLPortfolioPerformance;
  readonly lastUpdate: number;
}

export interface IHLPortfolioPositions {
  readonly count: number;
  readonly totalValue: string;
  readonly longValue: string;
  readonly shortValue: string;
  readonly topPositions: Array<{
    readonly coin: string;
    readonly value: string;
    readonly percentage: string;
    readonly pnl: string;
    readonly pnlPercent: string;
  }>;
}

export interface IHLPortfolioOrders {
  readonly openOrders: number;
  readonly totalOrderValue: string;
  readonly recentTrades: number;
  readonly avgOrderSize: string;
}

export interface IHLPortfolioRisk {
  readonly marginRatio: string;
  readonly leverageRatio: string;
  readonly concentrationRisk: string;
  readonly liquidationRisk: 'low' | 'medium' | 'high' | 'critical';
  readonly riskScore: number;
}

export interface IHLPortfolioPerformance {
  readonly totalTrades: number;
  readonly winTrades: number;
  readonly lossTrades: number;
  readonly winRate: string;
  readonly profitFactor: string;
  readonly sharpeRatio: string;
  readonly maxDrawdown: string;
  readonly averageWin: string;
  readonly averageLoss: string;
}

// =============================================================================
// Account Management Types
// =============================================================================

export interface IHLAccountSettings {
  readonly autoReduceOnly: boolean;
  readonly defaultLeverage: number;
  readonly preferredMarginMode: 'cross' | 'isolated';
  readonly riskToleranceLevel: 'low' | 'medium' | 'high';
  readonly autoTP: boolean;
  readonly autoSL: boolean;
  readonly maxPositionSize: string;
  readonly allowedAssets: string[];
  readonly tradingRestrictions: IHLTradingRestrictions;
}

export interface IHLTradingRestrictions {
  readonly maxLeverage: number;
  readonly maxPositionValue: string;
  readonly allowedOrderTypes: string[];
  readonly maxDailyVolume: string;
  readonly cooldownPeriod: number;
}

// =============================================================================
// History and Analytics Types
// =============================================================================

export interface IHLAccountHistory {
  readonly timeRange: {
    readonly startTime: number;
    readonly endTime: number;
  };
  readonly trades: IHLTradeHistory[];
  readonly transfers: IHLTransferHistory[];
  readonly fundingPayments: IHLFundingHistory[];
  readonly liquidations: IHLLiquidationHistory[];
  readonly pnlHistory: Array<{
    readonly timestamp: number;
    readonly totalPnl: string;
    readonly realizedPnl: string;
    readonly unrealizedPnl: string;
  }>;
}

export interface IHLTradeHistory {
  readonly tradeId: number;
  readonly orderId: number;
  readonly coin: string;
  readonly side: 'B' | 'A';
  readonly size: string;
  readonly price: string;
  readonly fee: string;
  readonly realizedPnl: string;
  readonly timestamp: number;
  readonly isMaker: boolean;
  readonly liquidation?: boolean;
}

export interface IHLTransferHistory {
  readonly id: string;
  readonly timestamp: number;
  readonly type: 'deposit' | 'withdraw' | 'internal_transfer' | 'spot_transfer';
  readonly asset: string;
  readonly amount: string;
  readonly status: 'pending' | 'completed' | 'failed' | 'canceled';
  readonly txHash?: IHLHex;
  readonly fee?: string;
}

export interface IHLFundingHistory {
  readonly timestamp: number;
  readonly coin: string;
  readonly fundingRate: string;
  readonly positionSize: string;
  readonly fundingAmount: string;
  readonly isPayment: boolean;
  readonly markPrice: string;
}

export interface IHLLiquidationHistory {
  readonly timestamp: number;
  readonly coin: string;
  readonly positionSize: string;
  readonly liquidationPrice: string;
  readonly markPrice: string;
  readonly pnl: string;
  readonly fee: string;
  readonly method: 'market' | 'backstop';
}

// =============================================================================
// Conversion Utilities - Moved to converters.ts
// =============================================================================

// NOTE: Conversion utilities have been consolidated into converters.ts to avoid duplication

// =============================================================================
// Type Guards
// =============================================================================

export function isPerpPosition(position: any): position is IHLPosition {
  return (
    position &&
    typeof position.coin === 'string' &&
    typeof position.size === 'string' &&
    typeof position.entryPrice === 'string' &&
    ['long', 'short'].includes(position.side)
  );
}

export function isPerpOpenOrder(order: any): order is IHLOpenOrder {
  return (
    order &&
    typeof order.orderId === 'number' &&
    typeof order.coin === 'string' &&
    typeof order.side === 'string' &&
    ['B', 'A'].includes(order.side)
  );
}

export function isPerpBalance(balance: any): balance is IHLBalance {
  return (
    balance &&
    typeof balance.asset === 'string' &&
    typeof balance.total === 'string' &&
    typeof balance.available === 'string'
  );
}
