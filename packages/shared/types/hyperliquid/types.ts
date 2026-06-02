import type { IFill, IHex, ITIF, IWithdraw3Request } from './sdk';
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
  USER_NON_FUNDING_LEDGER_UPDATES = 'userNonFundingLedgerUpdates',

  // v0.29.1 types
  WEB_DATA3 = 'webData3',
  ALL_DEXS_CLEARINGHOUSE_STATE = 'allDexsClearinghouseState',
  OPEN_ORDERS = 'openOrders',
  ALL_DEXS_ASSET_CTXS = 'allDexsAssetCtxs',
  TWAP_STATES = 'twapStates',
  USER_TWAP_HISTORY = 'userTwapHistory',
  USER_TWAP_SLICE_FILLS = 'userTwapSliceFills',
  BBO = 'bbo',
  SPOT_STATE = 'spotState',
  SPOT_ASSET_CTXS = 'spotAssetCtxs',
  ACTIVE_SPOT_ASSET_CTX = 'activeSpotAssetCtx',
  // TRADES = 'trades',
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
  orderType: { limit: { tif: ITIF } } | { market?: object };
  slippage?: number;
  reduceOnly?: boolean;
}

export interface IOrderOpenParams {
  assetId: number;
  isBuy: boolean;
  size: string;
  price: string;
  type: 'market' | 'limit';
  tif?: ITIF;
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

export interface IModifyOrderParams {
  oid: number;
  assetId: number;
  isBuy: boolean;
  // HL modify is not a patch: callers must pass full current values even when only amending price.
  sz: string;
  price: string;
  reduceOnly?: boolean;
  orderType?: { limit: { tif: ITIF } };
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

export interface ISpotDustingOptOutRequest {
  optOut: boolean;
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

// ── Standalone Trigger Order Types ──

export enum ETriggerOrderType {
  TRIGGER_MARKET = 'triggerMarket',
  TRIGGER_LIMIT = 'triggerLimit',
}

export interface ITriggerOrderParams {
  assetId: number;
  isBuy: boolean;
  size: string;
  triggerPx: string;
  triggerOrderType: ETriggerOrderType;
  tpsl: 'tp' | 'sl';
  executionPx?: string; // required for limit triggers
  reduceOnly: boolean;
  slippage?: number;
}

// ── Scale Order Types ──

export type IScaleOrderTif = ITIF;
export type IScaleOrderSizeDistribution = 'fixed' | 'increasing';

export interface IScaleOrderBuildParams {
  totalSize: string;
  lowerPrice: string;
  upperPrice: string;
  orderCount: number;
  szDecimals: number;
  side: 'long' | 'short';
  sizeSkew?: number;
  assetType?: 'perp' | 'spot';
}

export interface IScaleOrderLeg {
  index: number;
  price: string;
  size: string;
}

export interface IScaleOrderValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface IPlaceScaleOrderParams {
  assetId: number;
  coin: string;
  isBuy: boolean;
  size: string;
  lowerPrice: string;
  upperPrice: string;
  orderCount: number;
  reduceOnly?: boolean;
  tif?: IScaleOrderTif;
  szDecimals?: number;
  sizeSkew?: number;
  assetType?: 'perp' | 'spot';
}

// ── TWAP Order Types ──

export interface IPlaceTwapOrderParams {
  assetId: number;
  isBuy: boolean;
  size: string;
  reduceOnly: boolean;
  minutes: number;
  randomize: boolean;
  szDecimals?: number;
}

export interface ICancelTwapOrderParams {
  assetId: number;
  twapId: number;
}

export interface ISpotOrderParams {
  // Spot assetId = SPOT_ASSET_ID_OFFSET + spotUniverse.index
  assetId: number;
  isBuy: boolean;
  sz: string;
  limitPx: string;
  orderType: 'limit' | 'market';
  tif?: 'Gtc' | 'Ioc';
  slippage?: number;
  szDecimals?: number;
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

export interface IPerpActivityCard {
  id: string;
  imageUrl?: string;
  iconName?: string;
  title: string;
  subtitle: string;
  url: string;
}

export type IPerpAssetMetaAssetType = 'coingecko' | 'non_coingecko';

export interface IPerpAssetMeta {
  assetId: string;
  assetType?: IPerpAssetMetaAssetType;
  i18nKey?: string;
  localizedMessage?: string;
  message?: string;
}

export type IPerpsAssetMetaMap = Record<string, IPerpAssetMeta>;

export type IPerpServerBannerAlertType =
  | 'info'
  | 'warning'
  | 'critical'
  | 'success'
  | 'default'
  | 'danger'
  | 'caution';

export interface IPerpServerBannerConfig {
  id: string;
  alertType: IPerpServerBannerAlertType;
  title: string;
  description: string;
  href?: string;
  hrefType?: string;
  useSystemBrowser?: boolean;
  canClose?: boolean;
}

export interface IPerpCommonConfig {
  disablePerp?: boolean;
  usePerpWeb?: boolean;
  disablePerpActionPerp?: boolean;
  perpBannerConfig?: IPerpServerBannerConfig;
  ipDisablePerp?: boolean;
  perpBannerClosedIds?: string[];
  activityCards?: IPerpActivityCard[];
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

// Token Selector Types
export type IPerpTokenSelectorTab =
  | 'all'
  | 'perps'
  | 'spot'
  | 'hip3'
  | 'favorites';

export type IPerpTokenSortField =
  | 'name'
  | 'markPrice'
  | 'change24hPercent'
  | 'fundingRate'
  | 'volume24h'
  | 'openInterest'
  | 'marketCap';

export type IPerpTokenSortDirection = 'asc' | 'desc';

export interface IPerpTokenSelectorConfig {
  field: IPerpTokenSortField;
  direction: IPerpTokenSortDirection;
  activeTab: IPerpTokenSelectorTab | string; // string for dynamic tabs
}

// Deprecated: Use IPerpTokenSelectorConfig instead
export type IPerpTokenSortConfig = IPerpTokenSelectorConfig;

export enum EHyperLiquidAbstractionMode {
  DISABLED = 'disabled',
  UNIFIED_ACCOUNT = 'unifiedAccount',
  PORTFOLIO_MARGIN = 'portfolioMargin',
  DEX_ABSTRACTION = 'dexAbstraction',
  DEFAULT = 'default',
}

// ── Shared Types ──

export interface ITradesHistoryData {
  fills: IFill[];
  isLoaded: boolean;
  latestTime: number;
  accountAddress: string | undefined;
}

// ── Spot Types ──

export type ISpotFormattedAssetCtx = {
  midPrice: string;
  markPrice: string;
  prevDayPrice: string;
  volume24h: string;
  change24h: string;
  change24hPercent: number;
  circulatingSupply: string;
  totalSupply: string;
  dayBaseVlm: string;
};

export type ISpotTokenSortField =
  | 'name'
  | 'markPrice'
  | 'change24hPercent'
  | 'volume24h';

export interface ISpotTokenSelectorConfig {
  field: ISpotTokenSortField;
  direction: IPerpTokenSortDirection;
  activeTab: 'all' | 'favorites' | string;
}
