import type { IPerpServerBannerConfig } from '@onekeyhq/kit-bg/src/services/ServiceWebviewPerp/ServiceWebviewPerp';

import type { IHex, IWithdraw3Request } from './sdk';
import type { EHyperLiquidAgentName } from '../../src/consts/perp';

export enum EPerpsSubscriptionCategory {
  MARKET = 'market',
  ACCOUNT = 'account',
}
export enum ESubscriptionType {
  ALL_MIDS = 'allMids',
  L2_BOOK = 'l2Book',
  ACTIVE_ASSET_CTX = 'activeAssetCtx',
  ACTIVE_ASSET_DATA = 'activeAssetData',
  WEB_DATA2 = 'webData2',
  USER_FILLS = 'userFills',
  // TRADES = 'trades',
  // BBO = 'bbo',
  // USER_EVENTS = 'userEvents',
  // USER_NOTIFICATIONS = 'userNotifications',
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
  price: string;
  type: 'market' | 'limit';
  tpTriggerPx?: string;
  slTriggerPx?: string;
  slippage?: number;
}

export interface IOrderCloseParams {
  assetId: number;
  isBuy: boolean;
  size: string;
  midPx?: string;
  limitPx?: string;
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

export interface IWithdrawParams extends IWithdraw3Request {
  userAccountId: string;
}

export interface ILeverageUpdateRequest {
  asset: number;
  isCross: boolean;
  leverage: number;
}

export interface IUpdateIsolatedMarginRequest {
  asset: number;
  isBuy: boolean;
  ntli: number; // Margin amount in USDC (multiplied by 1e6): positive to add, negative to remove
}

export interface ISetReferrerRequest {
  code: string;
}

export interface IBuilderFeeRequest {
  builder: IHex;
  maxFeeRate: `${string}%`;
}

export interface IAgentApprovalRequest {
  agent: IHex;
  agentName: EHyperLiquidAgentName | undefined;
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

export interface IPerpOrderBookTickOptionPersist {
  value: string;
  nSigFigs: IL2BookOptions['nSigFigs'];
  mantissa: IL2BookOptions['mantissa'];
}

export type IHyperLiquidErrorMatcher =
  | {
      type: 'exact';
      value?: string;
    }
  | {
      type: 'regex';
      pattern?: string;
    };

export interface IHyperLiquidErrorLocaleItem {
  i18nKey: string;
  rawMessage: string;
  localizedMessage: string;
  variables: string[];
  matcher: IHyperLiquidErrorMatcher;
}

export interface IPerpCommonConfig {
  disablePerp?: boolean;
  usePerpWeb?: boolean;
  disablePerpActionPerp?: boolean;
  perpBannerConfig?: IPerpServerBannerConfig;
  ipDisablePerp?: boolean;
  perpBannerClosedIds?: string[];
}

export enum EPerpUserType {
  PERP_NATIVE = 'perpNative',
  PERP_WEB = 'perpWeb',
}
export interface IPerpUserConfig {
  currentUserType?: EPerpUserType;
}

export type IPerpsFormattedAssetCtx = {
  midPrice: string;
  lastPrice: string;
  markPrice: string;
  oraclePrice: string;
  prevDayPrice: string;
  fundingRate: string;
  openInterest: string;
  volume24h: string;
  change24h: string;
  change24hPercent: number;
};

export enum EPerpsSizeInputMode {
  MANUAL = 'manual',
  SLIDER = 'slider',
}

// Token Selector Sorting Types
export type IPerpTokenSortField =
  | 'name'
  | 'markPrice'
  | 'change24hPercent'
  | 'fundingRate'
  | 'volume24h'
  | 'openInterest';

export type IPerpTokenSortDirection = 'asc' | 'desc';

export interface IPerpTokenSortConfig {
  field: IPerpTokenSortField;
  direction: IPerpTokenSortDirection;
}
