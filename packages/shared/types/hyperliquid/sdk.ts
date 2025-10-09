import type { ESubscriptionType } from './types';
import type * as HL from '@nktkas/hyperliquid';

// import type { WebSocketAsyncRequest } from '@nktkas/hyperliquid/esm/src/transports/websocket/_hyperliquid_event_target.js';

// WebSocket data types
export type IWsWebData2 = HL.WsWebData2;
export type IWsAllMids = HL.WsAllMids;
export type IWsActiveAssetCtx = HL.WsActiveAssetCtx;
export type IWsUserEvent = HL.WsUserEvent;
export type IWsUserFills = HL.WsUserFills;
export type IWsBbo = HL.WsBbo;
export type IHyperliquidEventTarget = EventTarget; // HL.HyperliquidEventTarget;
// export type IWebSocketAsyncRequest = WebSocketAsyncRequest; // HL.WebSocketAsyncRequest;

export type IWsNotification = HL.WsNotification;
export type IWsTrade = HL.WsTrade;
export type IApiRequestError = HL.ApiRequestError;
export type IApiRequestResult = HL.SuccessResponse;
export type IApiErrorResponse = HL.ErrorResponse;

export type IPerpsAssetCtxRaw = HL.PerpsAssetCtx;
export type IPerpsAssetCtx = IPerpsAssetCtxRaw;

// Core trading types
export type IPerpsUniverseRaw = HL.PerpsUniverse;
export type IPerpsUniverse = IPerpsUniverseRaw & {
  assetId: number;
};
export type IMarginTables = HL.MarginTables;
export type IMarginTable = HL.MarginTable;
export type IMarginTableMap = Partial<{
  [key: number]: IMarginTable;
}>;
export type IOrder = HL.Order;
export type IPerpsFrontendOrder = HL.FrontendOrder;
export type IOrderParams = HL.OrderParams;
export type IOrderResponse = HL.OrderResponse;
export type ICancelResponse = HL.CancelResponse;
export type IOrderStatus<T extends HL.Order | HL.FrontendOrder = HL.Order> =
  HL.OrderStatus<T>;
export type IOrderProcessingStatus = HL.OrderProcessingStatus;
export type IOrderType = HL.OrderType;
export type ITIF = HL.TIF;

// Account and asset types
export type IPerpsAssetPosition = HL.AssetPosition;
export type IPerpsActiveAssetDataRaw = HL.ActiveAssetData;
export type IPerpsActiveAssetData = Omit<IPerpsActiveAssetDataRaw, 'user'> & {
  accountAddress: string;
  coin: string;
  assetId: number | undefined;
};
export type IPerpsClearinghouseState = HL.PerpsClearinghouseState;
export type ISpotClearinghouseState = HL.SpotClearinghouseState;
export type ISpotBalance = HL.SpotBalance;

// Client types
export type IInfoClient = HL.InfoClient;
export type IExchangeClient = HL.ExchangeClient;
export type ISubscriptionClient = HL.SubscriptionClient;
export type IPerpsSubscription = HL.Subscription;
export type IHttpTransport = HL.HttpTransport;
export type IWebSocketTransport = HL.WebSocketTransport;

// Market data types
export type IAllMids = HL.AllMids;
export type ICandle = HL.Candle;
export type IBook = HL.Book;
export type IBookLevel = HL.BookLevel;
export type IFill = HL.Fill;

// User and account types
export type IUserFees = HL.UserFees;
export type IUserRole = HL.UserRole;
export type IPortfolio = HL.Portfolio;
export type IReferral = HL.Referral;
export type IExtraAgent = HL.ExtraAgent;

// Request types
export type IUserFillsByTimeParameters = HL.UserFillsByTimeParameters;
export type IUserFillsParameters = HL.UserFillsParameters;
export type ICandleSnapshotParameters = HL.CandleSnapshotParameters;
export type IWithdraw3Request = HL.Withdraw3Parameters;
export type IOrderRequest = HL.OrderParameters;
// Subscription parameter types
export type IWsAllMidsParameters = HL.WsAllMidsParameters;
export type IEventActiveAssetCtxParameters = HL.EventActiveAssetCtxParameters;
export type IEventActiveAssetDataParameters = HL.EventActiveAssetDataParameters;
export type IEventBboParameters = HL.EventBboParameters;
export type IEventL2BookParameters = HL.EventL2BookParameters;
export type IEventNotificationParameters = HL.EventNotificationParameters;
export type IEventTradesParameters = HL.EventTradesParameters;
export type IEventUserEventsParameters = HL.EventUserEventsParameters;
export type IEventWebData2Parameters = HL.EventWebData2Parameters;
export type IEventUserFillsParameters = HL.EventUserFillsParameters;

// Response types
export type ISuccessResponse = HL.SuccessResponse;
export type IErrorResponse = HL.ErrorResponse;

// Basic types
export type IHex = `0x${string}`;
export type ISignature = HL.Signature;

export type IPerpsSubscriptionParams = {
  [ESubscriptionType.L2_BOOK]: IEventL2BookParameters;
  [ESubscriptionType.USER_FILLS]: IEventUserFillsParameters;
  [ESubscriptionType.USER_EVENTS]: IEventUserEventsParameters;
  [ESubscriptionType.USER_NOTIFICATIONS]: IEventNotificationParameters;
  [ESubscriptionType.ACTIVE_ASSET_DATA]: IEventActiveAssetDataParameters;
  [ESubscriptionType.WEB_DATA2]: IEventWebData2Parameters;
  [ESubscriptionType.ALL_MIDS]: IWsAllMidsParameters;
  [ESubscriptionType.ACTIVE_ASSET_CTX]: IEventActiveAssetCtxParameters;
  [ESubscriptionType.TRADES]: IEventTradesParameters;
  [ESubscriptionType.BBO]: IEventBboParameters;
};

export type IWebSocketTransportOptions = HL.WebSocketTransportOptions;
