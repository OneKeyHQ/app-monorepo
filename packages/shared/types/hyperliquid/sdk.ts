// Pure SDK type re-exports for Hyperliquid
// This file directly re-exports SDK types to reduce duplication and maintain consistency

import type * as HL from '@nktkas/hyperliquid';

// =============================================================================
// Core SDK Client Types
// =============================================================================
export type IHLInfoClient = HL.InfoClient;
export type IHLExchangeClient = HL.ExchangeClient;
export type IHLSubscriptionClient = HL.SubscriptionClient;

// =============================================================================
// Transport Types
// =============================================================================
export type IHLHttpTransport = HL.HttpTransport;
export type IHLWebSocketTransport = HL.WebSocketTransport;

// =============================================================================
// Basic Data Types
// =============================================================================
export type IHLHex = `0x${string}`;
export type IHLSignature = {
  readonly r: IHLHex;
  readonly s: IHLHex;
  readonly v: 27 | 28;
};

// =============================================================================
// Order Related Types
// =============================================================================
// Note: Some order-related types may need manual definition as they're not exported from SDK
export type IHLOrder = HL.Order;
export type IHLFrontendOrder = HL.FrontendOrder;
export type IHLOrderStatus<T extends HL.Order | HL.FrontendOrder = HL.Order> = HL.OrderStatus<T>;
export type IHLOrderProcessingStatus = HL.OrderProcessingStatus;
export type IHLOrderType = HL.OrderType;
export type IHLOrderLookup = HL.OrderLookup;
export type IHLTIF = HL.TIF;

// Manual definition for OrderParams (not exported from SDK)
export interface IHLOrderParams {
  readonly a: number;
  readonly b: boolean;
  readonly p: string;
  readonly s: string;
  readonly r: boolean;
  readonly t: {
    readonly limit: { readonly tif: IHLTIF };
  } | {
    readonly trigger: {
      readonly isMarket: boolean;
      readonly triggerPx: string;
      readonly tpsl: 'tp' | 'sl';
    };
  };
  readonly c?: IHLHex;
}

// =============================================================================
// Trading Types
// =============================================================================
export type IHLFill = HL.Fill;
export type IHLFillLiquidation = HL.FillLiquidation;
export type IHLBook = HL.Book;
export type IHLBookLevel = HL.BookLevel;

// =============================================================================
// TWAP Order Types
// =============================================================================
export type IHLTwapHistory = HL.TwapHistory;
export type IHLTwapState = HL.TwapState;
export type IHLTwapStatus = HL.TwapStatus;
export type IHLTwapSliceFill = HL.TwapSliceFill;

// =============================================================================
// Account Related Types
// =============================================================================
export type IHLPerpsClearinghouseState = HL.PerpsClearinghouseState;
export type IHLSpotClearinghouseState = HL.SpotClearinghouseState;
export type IHLAssetPosition = HL.AssetPosition;
export type IHLActiveAssetData = HL.ActiveAssetData;
export type IHLSpotBalance = HL.SpotBalance;
export type IHLEvmEscrowsBalance = HL.EvmEscrowsBalance;

// =============================================================================
// User Related Types
// =============================================================================
export type IHLUserFees = HL.UserFees;
export type IHLUserRole = HL.UserRole;
export type IHLUserRateLimit = HL.UserRateLimit;
export type IHLUserFundingUpdate = HL.UserFundingUpdate;
export type IHLUserNonFundingLedgerUpdate = HL.UserNonFundingLedgerUpdate;
export type IHLFundingUpdate = HL.FundingUpdate;
export type IHLSubAccount = HL.SubAccount;
export type IHLPortfolio = HL.Portfolio;
export type IHLPortfolioPeriods = HL.PortfolioPeriods;
export type IHLReferral = HL.Referral;
export type IHLExtraAgent = HL.ExtraAgent;
export type IHLMultiSigSigners = HL.MultiSigSigners;
export type IHLLegalCheck = HL.LegalCheck;
export type IHLPreTransferCheck = HL.PreTransferCheck;

// =============================================================================
// Exchange Request Types (Manually defined as not exported from SDK)
// =============================================================================

export interface IHLOrderRequest {
  readonly action: {
    readonly type: 'order';
    readonly orders: IHLOrderParams[];
    readonly grouping: 'na' | 'normalTpsl' | 'positionTpsl';
    readonly builder?: {
      readonly b: IHLHex;
      readonly f: number;
    };
  };
  readonly nonce: number;
  readonly signature: IHLSignature;
  readonly vaultAddress?: IHLHex;
  readonly expiresAfter?: number;
}

export interface IHLCancelRequest {
  readonly action: {
    readonly type: 'cancel';
    readonly cancels: Array<{
      readonly a: number;
      readonly o: number;
    }>;
  };
  readonly nonce: number;
  readonly signature: IHLSignature;
  readonly vaultAddress?: IHLHex;
  readonly expiresAfter?: number;
}

export interface IHLCancelByCloidRequest {
  readonly action: {
    readonly type: 'cancelByCloid';
    readonly cancels: Array<{
      readonly asset: number;
      readonly cloid: IHLHex;
    }>;
  };
  readonly nonce: number;
  readonly signature: IHLSignature;
  readonly vaultAddress?: IHLHex;
  readonly expiresAfter?: number;
}

export interface IHLModifyRequest {
  readonly action: {
    readonly type: 'modify';
    readonly oid: number | IHLHex;
    readonly order: IHLOrderParams;
  };
  readonly nonce: number;
  readonly signature: IHLSignature;
  readonly vaultAddress?: IHLHex;
  readonly expiresAfter?: number;
}

export interface IHLBatchModifyRequest {
  readonly action: {
    readonly type: 'batchModify';
    readonly modifies: Array<{
      readonly oid: number | IHLHex;
      readonly order: IHLOrderParams;
    }>;
  };
  readonly nonce: number;
  readonly signature: IHLSignature;
  readonly vaultAddress?: IHLHex;
  readonly expiresAfter?: number;
}

export interface IHLTwapOrderRequest {
  readonly action: {
    readonly type: 'twapOrder';
    readonly twap: {
      readonly a: number;
      readonly b: boolean;
      readonly s: string;
      readonly r: boolean;
      readonly m: number;
      readonly t: boolean;
    };
  };
  readonly nonce: number;
  readonly signature: IHLSignature;
  readonly vaultAddress?: IHLHex;
  readonly expiresAfter?: number;
}

export interface IHLTwapCancelRequest {
  readonly action: {
    readonly type: 'twapCancel';
    readonly a: number;
    readonly t: number;
  };
  readonly nonce: number;
  readonly signature: IHLSignature;
  readonly vaultAddress?: IHLHex;
  readonly expiresAfter?: number;
}

export interface IHLUpdateLeverageRequest {
  readonly action: {
    readonly type: 'updateLeverage';
    readonly asset: number;
    readonly isCross: boolean;
    readonly leverage: number;
  };
  readonly nonce: number;
  readonly signature: IHLSignature;
  readonly vaultAddress?: IHLHex;
  readonly expiresAfter?: number;
}

export interface IHLUpdateIsolatedMarginRequest {
  readonly action: {
    readonly type: 'updateIsolatedMargin';
    readonly asset: number;
    readonly isBuy: boolean;
    readonly ntli: number;
  };
  readonly nonce: number;
  readonly signature: IHLSignature;
  readonly vaultAddress?: IHLHex;
  readonly expiresAfter?: number;
}

// Simplified versions of other request types (only including the most commonly used ones)
export interface IHLUsdSendRequest {
  readonly action: {
    readonly type: 'usdSend';
    readonly signatureChainId: IHLHex;
    readonly hyperliquidChain: 'Mainnet' | 'Testnet';
    readonly destination: IHLHex;
    readonly amount: string;
    readonly time: number;
  };
  readonly nonce: number;
  readonly signature: IHLSignature;
}

export interface IHLWithdraw3Request {
  readonly action: {
    readonly type: 'withdraw3';
    readonly signatureChainId: IHLHex;
    readonly hyperliquidChain: 'Mainnet' | 'Testnet';
    readonly destination: IHLHex;
    readonly amount: string;
    readonly time: number;
  };
  readonly nonce: number;
  readonly signature: IHLSignature;
}

export interface IHLUsdClassTransferRequest {
  readonly action: {
    readonly type: 'usdClassTransfer';
    readonly signatureChainId: IHLHex;
    readonly hyperliquidChain: 'Mainnet' | 'Testnet';
    readonly amount: string;
    readonly toPerp: boolean;
    readonly nonce: number;
  };
  readonly nonce: number;
  readonly signature: IHLSignature;
}

// Generic request types for less commonly used operations
export interface IHLGenericRequest {
  readonly action: {
    readonly type: string;
    readonly [key: string]: any;
  };
  readonly nonce: number;
  readonly signature: IHLSignature;
  readonly vaultAddress?: IHLHex;
  readonly expiresAfter?: number;
}

// Type aliases for backward compatibility
export type IHLApproveAgentRequest = IHLGenericRequest;
export type IHLApproveBuilderFeeRequest = IHLGenericRequest;
export type IHLSpotSendRequest = IHLGenericRequest;
export type IHLVaultTransferRequest = IHLGenericRequest;
export type IHLCreateVaultRequest = IHLGenericRequest;
export type IHLVaultModifyRequest = IHLGenericRequest;
export type IHLVaultDistributeRequest = IHLGenericRequest;
export type IHLSubAccountTransferRequest = IHLGenericRequest;
export type IHLSubAccountSpotTransferRequest = IHLGenericRequest;
export type IHLCreateSubAccountRequest = IHLGenericRequest;
export type IHLSubAccountModifyRequest = IHLGenericRequest;
export type IHLSetReferrerRequest = IHLGenericRequest;
export type IHLRegisterReferrerRequest = IHLGenericRequest;
export type IHLClaimRewardsRequest = IHLGenericRequest;
export type IHLSetDisplayNameRequest = IHLGenericRequest;
export type IHLTokenDelegateRequest = IHLGenericRequest;
export type IHLCDepositRequest = IHLGenericRequest;
export type IHLCWithdrawRequest = IHLGenericRequest;
export type IHLScheduleCancelRequest = IHLGenericRequest;
export type IHLReserveRequestWeightRequest = IHLGenericRequest;
export type IHLEvmUserModifyRequest = IHLGenericRequest;
export type IHLSpotUserRequest = IHLGenericRequest;

// =============================================================================
// Exchange Response Types
// =============================================================================
export type IHLOrderResponse = HL.OrderResponse;
export type IHLOrderSuccessResponse = HL.OrderSuccessResponse;
export type IHLCancelResponse = HL.CancelResponse;
export type IHLCancelSuccessResponse = HL.CancelSuccessResponse;
export type IHLTwapOrderResponse = HL.TwapOrderResponse;
export type IHLTwapOrderSuccessResponse = HL.TwapOrderSuccessResponse;
export type IHLTwapCancelResponse = HL.TwapCancelResponse;
export type IHLTwapCancelSuccessResponse = HL.TwapCancelSuccessResponse;
export type IHLSuccessResponse = HL.SuccessResponse;
export type IHLErrorResponse = HL.ErrorResponse;
export type IHLCreateVaultResponse = HL.CreateVaultResponse;
export type IHLCreateSubAccountResponse = HL.CreateSubAccountResponse;

// =============================================================================
// Subscription (WebSocket) Types
// =============================================================================
export type IHLWsAllMids = HL.WsAllMids;
export type IHLWsWebData2 = HL.WsWebData2;
export type IHLPerpsUniverse = HL.PerpsUniverse;
export type IHLWsUserEvent = HL.WsUserEvent;
export type IHLWsUserFundings = HL.WsUserFundings;
export type IHLWsUserNonFundingLedgerUpdates = HL.WsUserNonFundingLedgerUpdates;
export type IHLWsBbo = HL.WsBbo;
export type IHLWsNotification = HL.WsNotification;
export type IHLWsTrade = HL.WsTrade;
export type IHLWsActiveAssetCtx = HL.WsActiveAssetCtx;
export type IHLWsActiveSpotAssetCtx = HL.WsActiveSpotAssetCtx;

// =============================================================================
// Market Data Types
// =============================================================================
export type IHLAllMids = HL.AllMids;
export type IHLCandle = HL.Candle;
export type IHLPerpsMeta = HL.PerpsMeta;
export type IHLSpotMeta = HL.SpotMeta;
export type IHLPerpsMetaAndAssetCtxs = HL.PerpsMetaAndAssetCtxs;
export type IHLSpotMetaAndAssetCtxs = HL.SpotMetaAndAssetCtxs;

// =============================================================================
// Union Types for Better Organization
// =============================================================================

// All Exchange Request Types
export type IHLExchangeRequest = 
  | IHLOrderRequest
  | IHLCancelRequest
  | IHLCancelByCloidRequest
  | IHLModifyRequest
  | IHLBatchModifyRequest
  | IHLTwapOrderRequest
  | IHLTwapCancelRequest
  | IHLUpdateLeverageRequest
  | IHLUpdateIsolatedMarginRequest
  | IHLApproveAgentRequest
  | IHLApproveBuilderFeeRequest
  | IHLUsdSendRequest
  | IHLWithdraw3Request
  | IHLUsdClassTransferRequest
  | IHLSpotSendRequest
  | IHLVaultTransferRequest
  | IHLCreateVaultRequest
  | IHLVaultModifyRequest
  | IHLVaultDistributeRequest
  | IHLSubAccountTransferRequest
  | IHLSubAccountSpotTransferRequest
  | IHLCreateSubAccountRequest
  | IHLSubAccountModifyRequest
  | IHLSetReferrerRequest
  | IHLRegisterReferrerRequest
  | IHLClaimRewardsRequest
  | IHLSetDisplayNameRequest
  | IHLTokenDelegateRequest
  | IHLCDepositRequest
  | IHLCWithdrawRequest
  | IHLScheduleCancelRequest
  | IHLReserveRequestWeightRequest
  | IHLEvmUserModifyRequest
  | IHLSpotUserRequest;

// All Exchange Response Types
export type IHLExchangeResponse = 
  | IHLOrderResponse
  | IHLCancelResponse
  | IHLTwapOrderResponse
  | IHLTwapCancelResponse
  | IHLSuccessResponse
  | IHLErrorResponse
  | IHLCreateVaultResponse
  | IHLCreateSubAccountResponse;

// All WebSocket Data Types
export type IHLWebSocketData = 
  | IHLWsAllMids
  | IHLWsWebData2
  | IHLWsUserEvent
  | IHLWsUserFundings
  | IHLWsUserNonFundingLedgerUpdates
  | IHLWsBbo
  | IHLWsNotification
  | IHLWsTrade
  | IHLWsActiveAssetCtx
  | IHLWsActiveSpotAssetCtx;

// =============================================================================
// Type Guards for SDK Types
// =============================================================================

export function isOrderResponse(response: IHLExchangeResponse): response is IHLOrderResponse {
  return 'response' in response && typeof response.response === 'object' && 
         response.response !== null && 'type' in response.response && 
         response.response.type === 'order';
}

export function isErrorResponse(response: IHLExchangeResponse): response is IHLErrorResponse {
  return 'status' in response && response.status === 'err';
}

// =============================================================================
// Utility Types
// =============================================================================

// Extract common properties for easier access
export type IHLOrderSide = IHLOrder['side'];
export type IHLAssetSymbol = IHLOrder['coin'];
export type IHLOrderId = IHLOrder['oid'];
export type IHLClientOrderId = NonNullable<IHLOrder['cloid']>;
export type IHLPrice = IHLOrder['limitPx'];
export type IHLSize = IHLOrder['sz'];
export type IHLTimestamp = IHLOrder['timestamp'];
