import type { IHex, IWithdraw3Request } from './sdk';

export enum ESubscriptionType {
  ALL_MIDS = 'allMids',
  ACTIVE_ASSET_CTX = 'activeAssetCtx',
  WEB_DATA2 = 'webData2',
  USER_FILLS = 'userFills',
  L2_BOOK = 'l2Book',
  TRADES = 'trades',
  BBO = 'bbo',
  ACTIVE_ASSET_DATA = 'activeAssetData',
  USER_EVENTS = 'userEvents',
  USER_NOTIFICATIONS = 'userNotifications',
}

export interface IConnectionState {
  readonly isConnected: boolean;
  readonly lastConnected: number | null;
  readonly reconnectCount: number;
}

export interface ITradingFormData {
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  size: string;
  price: string;
  reduceOnly: boolean;
  takeProfitPrice: string;
  stopLossPrice: string;
}

export interface IEnhancedPosition {
  displayPnl: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface ITokenDisplayData {
  coin: string;
  lastPrice: string;
  change24h: string;
  change24hPercent: string;
  volume24h: string;
  funding8h: string;
  maxLeverage: number;
}

export interface ITokenListItem {
  readonly coin: string;
  readonly lastPrice: string;
  readonly change24h: string;
  readonly change24hPercent: string;
  readonly funding8h: string;
  readonly volume24h: string;
  readonly openInterest: string;
  readonly markPrice: string;
  readonly indexPrice: string;
  readonly fundingRate: string;
}

// request types
export interface IPlaceOrderParams {
  assetId: number;
  isBuy: boolean;
  sz: string;
  limitPx?: string;
  orderType: { limit: { tif: 'Gtc' | 'Ioc' } } | { market?: object };
  slippage?: number;
  reduceOnly?: boolean;
}

export interface IOrderOpenParams {
  assetId: number;
  isBuy: boolean;
  size: string;
  midPx: string;
  type: 'market' | 'limit';
  tpTriggerPx?: string;
  slTriggerPx?: string;
  slippage?: number;
}

export interface IOrderCloseParams {
  assetId: number;
  isBuy: boolean;
  size: string;
  midPx: string;
  slippage?: number;
}

export interface IUpdateLeverageParams {
  assetId: number;
  leverage: number;
  isCross?: boolean;
}

export interface ICancelOrderParams {
  assetId: number;
  oid: number;
}

export interface IMultiOrderParams {
  orders: Array<{
    assetId: number;
    isBuy: boolean;
    sz: string;
    limitPx: string;
    orderType: { limit: { tif: 'Gtc' | 'Ioc' } };
  }>;
}

export interface IWithdrawParams extends IWithdraw3Request {
  userAccountId: string;
}

export interface ILeverageUpdateRequest {
  asset: number;
  isCross: boolean;
  leverage: number;
}

export interface IBuilderFeeRequest {
  builder: IHex;
  maxFeeRate: `${string}%`;
}

export interface IAgentApprovalRequest {
  agent: IHex;
  authorize: boolean;
}

export interface IPositionTpslOrderParams {
  assetId: number;
  positionSize: string;
  isBuy: boolean;
  tpTriggerPx?: string;
  slTriggerPx?: string;
  slippage?: number;
}

export interface IL2BookOptions {
  nSigFigs?: 2 | 3 | 4 | 5 | null;
  mantissa?: 2 | 5 | null;
}
