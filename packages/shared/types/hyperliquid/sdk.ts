import type * as HL from '@nktkas/hyperliquid';

// WebSocket data types
export type WsWebData2 = HL.WsWebData2;
export type WsAllMids = HL.WsAllMids;
export type WsActiveAssetCtx = HL.WsActiveAssetCtx;
export type WsUserEvent = HL.WsUserEvent;
export type WsUserFills = HL.WsUserFills;
export type WsBbo = HL.WsBbo;
export type WsNotification = HL.WsNotification;
export type WsTrade = HL.WsTrade;

// Core trading types
export type Order = HL.Order;
export type FrontendOrder = HL.FrontendOrder;
export type OrderParams = HL.OrderParams;
export type OrderResponse = HL.OrderResponse;
export type CancelResponse = HL.CancelResponse;
export type OrderStatus<T extends HL.Order | HL.FrontendOrder = HL.Order> = HL.OrderStatus<T>;
export type OrderProcessingStatus = HL.OrderProcessingStatus;
export type OrderType = HL.OrderType;
export type TIF = HL.TIF;

// Account and asset types
export type AssetPosition = HL.AssetPosition;
export type ActiveAssetData = HL.ActiveAssetData;
export type PerpsClearinghouseState = HL.PerpsClearinghouseState;
export type SpotClearinghouseState = HL.SpotClearinghouseState;
export type SpotBalance = HL.SpotBalance;

// Client types
export type InfoClient = HL.InfoClient;
export type ExchangeClient = HL.ExchangeClient;
export type SubscriptionClient = HL.SubscriptionClient;
export type HttpTransport = HL.HttpTransport;
export type WebSocketTransport = HL.WebSocketTransport;

// Market data types
export type AllMids = HL.AllMids;
export type Candle = HL.Candle;
export type Book = HL.Book;
export type BookLevel = HL.BookLevel;
export type Fill = HL.Fill;

// User and account types
export type UserFees = HL.UserFees;
export type UserRole = HL.UserRole;
export type Portfolio = HL.Portfolio;
export type Referral = HL.Referral;
export type ExtraAgent = HL.ExtraAgent;

export type UserFillsByTimeParameters = HL.UserFillsByTimeParameters;
// Request types (define manually as SDK may not export these)
export interface OrderRequest {
  action: {
    type: 'order';
    orders: OrderParams[];
    grouping: 'na' | 'normalTpsl' | 'positionTpsl';
  };
  nonce: number;
  signature: Signature;
}

// Response types  
export type SuccessResponse = HL.SuccessResponse;
export type ErrorResponse = HL.ErrorResponse;

// Basic types
export type Hex = `0x${string}`;
export type Signature = HL.Signature;
