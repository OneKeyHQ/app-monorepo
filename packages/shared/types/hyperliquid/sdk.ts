/* cspell:ignore Fundings */

import type { ESubscriptionType, IPerpsFormattedAssetCtx } from './types';
import type * as HL from '@nktkas/hyperliquid';

// WebSocket event types
export type IWsWebData2 = HL.WebData2WsEvent;
export type IWsWebData3 = HL.WebData3WsEvent;
export type IWsAllMids = HL.AllMidsWsEvent;
export type IWsActiveAssetCtx = HL.ActiveAssetCtxWsEvent;
export type IWsUserEvent = HL.UserEventsWsEvent;
export type IWsUserFills = HL.UserFillsWsEvent;
export type IWsUserNonFundingLedgerUpdates =
  HL.UserNonFundingLedgerUpdatesWsEvent;
export type IWsOpenOrders = HL.OpenOrdersWsEvent;
export type IWsAllDexsClearinghouseState = HL.AllDexsClearinghouseStateWsEvent;
export type IWsAllDexsAssetCtxs = HL.AllDexsAssetCtxsWsEvent;
export type IWsBbo = HL.BboWsEvent;
export type IWsTwapStates = HL.TwapStatesWsEvent;
export type IWsUserTwapHistory = HL.UserTwapHistoryWsEvent;
export type IWsUserTwapSliceFills = HL.UserTwapSliceFillsWsEvent;
export type ITwapState = IWsTwapStates['states'][number][1];
export type ITwapHistoryRecord = HL.TwapHistoryResponse[number];
export type ITwapSliceFill = HL.UserTwapSliceFillsResponse[number];

// Spot WebSocket event types
export type IWsSpotState = HL.SpotStateWsEvent;
export type IWsSpotAssetCtxs = HL.SpotAssetCtxsWsEvent;
export type IWsActiveSpotAssetCtx = HL.ActiveSpotAssetCtxWsEvent;
export type ISpotBalance = IWsSpotState['spotState']['balances'][number];
export type IEventSpotStateParameters = HL.SpotStateWsParameters;
export type IEventSpotAssetCtxsParameters = Record<string, never>;
export type IEventActiveSpotAssetCtxParameters =
  HL.ActiveSpotAssetCtxWsParameters;

// Abstraction query types
export type IUserAbstractionResponse = HL.UserAbstractionResponse;

export type IHyperliquidEventTarget = EventTarget;

export type IUserNonFundingLedgerUpdate =
  HL.UserNonFundingLedgerUpdatesWsEvent['nonFundingLedgerUpdates'][number];
export type IDepositUpdate = Extract<
  IUserNonFundingLedgerUpdate['delta'],
  { type: 'deposit' }
>;
export interface IDepositPending extends IDepositUpdate {
  status: string;
}

// API responses / request results
export type IApiRequestError = HL.ApiRequestError;
export type IApiRequestResult =
  | HL.OrderSuccessResponse
  | HL.CancelSuccessResponse
  | HL.ApproveAgentSuccessResponse;
export type IApiErrorResponse = HL.ApiRequestError;

// Info & market data types
export type IPerpsUniverseRaw = HL.MetaResponse['universe'][number];
export type IPerpsUniverse = IPerpsUniverseRaw & { assetId: number };
export type IPerpsAssetCtx =
  HL.AllDexsAssetCtxsWsEvent['ctxs'][number][1][number];
export type IActiveAssetData = HL.ActiveAssetDataWsEvent;
export type IPerpsActiveAssetDataRaw = IActiveAssetData;
export type IPerpsActiveAssetData = Omit<IActiveAssetData, 'user'> & {
  accountAddress: string;
  coin: string;
  assetId: number | undefined;
};
export type IAllPerpMetasResponse = HL.AllPerpMetasResponse;

// Spot info types
export type ISpotMetaResponse = HL.SpotMetaResponse;
export type ISpotMetaAndAssetCtxsResponse = HL.SpotMetaAndAssetCtxsResponse;
export type ISpotClearinghouseStateResponse = HL.SpotClearinghouseStateResponse;
export type ISpotToken = ISpotMetaResponse['tokens'][number];
export type ISpotUniverseRaw = ISpotMetaResponse['universe'][number];
export type ISpotUniverse = ISpotUniverseRaw & {
  assetId: number;
  baseName: string;
  quoteName: string;
  displayName: string;
  baseSzDecimals: number;
};
export type ISpotAssetCtx = IWsSpotAssetCtxs[number];

export type IMarginTable = HL.MarginTableResponse;
export type IMarginTableMap = Partial<Record<number, IMarginTable>>;
export type IMetaAndAssetCtxsResponse = HL.MetaAndAssetCtxsResponse;
export type IFundingHistoryRecord = HL.FundingHistoryResponse[number];
export type IRecentTrade = HL.RecentTradesResponse[number];
export type IPerpAnnotation = HL.PerpAnnotationResponse;
export type IPerpsAtOpenInterestCapResponse = HL.PerpsAtOpenInterestCapResponse;
export type IPredictedFundingEntry = HL.PredictedFundingsResponse[number];

export interface IPerpPredictedFundingVenue {
  exchange: string;
  fundingRate: string | null;
  nextFundingTime: number | null;
  fundingIntervalHours?: number;
}

export interface IPerpMarketOverview {
  coin: string;
  assetId: number | undefined;
  ctx: IPerpsFormattedAssetCtx;
  premium: string | null;
  dayBaseVolume: string;
  openInterestNotional: string | null;
}

export interface IPerpContractInfo {
  coin: string;
  assetId: number | undefined;
  szDecimals?: number;
  maxLeverage?: number;
  marginMode?: string;
  onlyIsolated?: boolean;
  marginTable?: IMarginTable;
  isAtOpenInterestCap: boolean;
}

// Orders
export type IPerpsFrontendOrder = HL.OpenOrdersWsEvent['orders'][number];
export type IOrderParams = HL.OrderParameters['orders'][number];
export type IOrderResponse = HL.OrderSuccessResponse;
export type ICancelResponse = HL.CancelSuccessResponse;
export type IModifyResponse = HL.ModifySuccessResponse;
export type ITwapOrderResponse = HL.TwapOrderSuccessResponse;
export type ITwapCancelResponse = HL.TwapCancelSuccessResponse;
export type ITIF = 'Gtc' | 'Ioc' | 'Alo';

// Account and asset states
export type IPerpsAssetPosition =
  HL.ClearinghouseStateResponse['assetPositions'][number];
export type IPerpsClearinghouseState = HL.ClearinghouseStateResponse;

// Client types
export type IInfoClient = HL.InfoClient;
export type IExchangeClient = HL.ExchangeClient;
export type ISubscriptionClient = HL.SubscriptionClient;
export type IPerpsSubscription = HL.ISubscription;
export type IHttpTransport = HL.HttpTransport;
export type IWebSocketTransport = HL.WebSocketTransport;

// Market data types
export type IAllMids = HL.AllMidsResponse;
export type ICandle = HL.CandleSnapshotResponse[number];
export type IBook = HL.L2BookWsEvent;
export type IBookLevel = IBook['levels'][number][number];
export type IFill = HL.UserFillsResponse[number];

// User and account types
export type IUserFees = HL.UserFeesResponse;
export type IUserRole = HL.UserRoleResponse;
export type IPortfolio = HL.PortfolioResponse;
export type IPortfolioMetrics = IPortfolio[number][1];
export type IUserNonFundingLedgerUpdatesResponse =
  HL.UserNonFundingLedgerUpdatesResponse;
export type IReferral = HL.ReferralResponse;

// Request types
export type IUserFillsByTimeParameters = HL.UserFillsByTimeParameters;
export type IUserFillsParameters = HL.UserFillsParameters;
export type ITwapHistoryParameters = HL.TwapHistoryParameters;
export type IUserTwapSliceFillsParameters = HL.UserTwapSliceFillsParameters;
export type IUserTwapSliceFillsByTimeParameters =
  HL.UserTwapSliceFillsByTimeParameters;
export type ICandleSnapshotParameters = HL.CandleSnapshotParameters;
export type IWithdraw3Request = HL.Withdraw3Parameters;
export type IOrderRequest = HL.OrderParameters;

// Subscription parameter types
export type IWsAllMidsParameters = HL.AllMidsWsParameters;
export type IEventActiveAssetCtxParameters = HL.ActiveAssetCtxWsParameters;
export type IEventActiveAssetDataParameters = HL.ActiveAssetDataWsParameters;
export type IEventL2BookParameters = HL.L2BookWsParameters;
export type IEventBboParameters = HL.BboWsParameters;
export type IEventWebData2Parameters = HL.WebData2WsParameters;
export type IEventUserFillsParameters = HL.UserFillsWsParameters;
export type IEventUserNonFundingLedgerUpdatesParameters =
  HL.UserNonFundingLedgerUpdatesWsParameters;
export type IEventWebData3Parameters = HL.WebData3WsParameters;
export type IEventAllDexsClearinghouseStateParameters =
  HL.AllDexsClearinghouseStateWsParameters;
export type IEventOpenOrdersParameters = HL.OpenOrdersWsParameters;
export type IEventAllDexsAssetCtxsParameters = Record<string, never>;
export type IEventTwapStatesParameters = HL.TwapStatesWsParameters;
export type IEventUserTwapHistoryParameters = HL.UserTwapHistoryWsParameters;
export type IEventUserTwapSliceFillsParameters =
  HL.UserTwapSliceFillsWsParameters;

// Response types
export type ISuccessResponse = unknown;
export type IErrorResponse = HL.ApiRequestError;

// Basic types
export type IHex = `0x${string}`;
export type ISignature = unknown;

export type IPerpsSubscriptionParams = {
  [ESubscriptionType.L2_BOOK]: IEventL2BookParameters;
  [ESubscriptionType.BBO]: IEventBboParameters;
  [ESubscriptionType.USER_FILLS]: IEventUserFillsParameters;
  [ESubscriptionType.USER_NON_FUNDING_LEDGER_UPDATES]: IEventUserNonFundingLedgerUpdatesParameters;

  [ESubscriptionType.ACTIVE_ASSET_DATA]: IEventActiveAssetDataParameters;
  [ESubscriptionType.WEB_DATA2]: IEventWebData2Parameters;
  [ESubscriptionType.ALL_MIDS]: IWsAllMidsParameters;
  [ESubscriptionType.ACTIVE_ASSET_CTX]: IEventActiveAssetCtxParameters;

  [ESubscriptionType.WEB_DATA3]: IEventWebData3Parameters;
  [ESubscriptionType.ALL_DEXS_CLEARINGHOUSE_STATE]: IEventAllDexsClearinghouseStateParameters;
  [ESubscriptionType.OPEN_ORDERS]: IEventOpenOrdersParameters;
  [ESubscriptionType.ALL_DEXS_ASSET_CTXS]: IEventAllDexsAssetCtxsParameters;
  [ESubscriptionType.TWAP_STATES]: IEventTwapStatesParameters;
  [ESubscriptionType.USER_TWAP_HISTORY]: IEventUserTwapHistoryParameters;
  [ESubscriptionType.USER_TWAP_SLICE_FILLS]: IEventUserTwapSliceFillsParameters;
  [ESubscriptionType.SPOT_STATE]: IEventSpotStateParameters;
  [ESubscriptionType.SPOT_ASSET_CTXS]: IEventSpotAssetCtxsParameters;
  [ESubscriptionType.ACTIVE_SPOT_ASSET_CTX]: IEventActiveSpotAssetCtxParameters;
};

export type IWebSocketTransportOptions = HL.WebSocketTransportOptions;
