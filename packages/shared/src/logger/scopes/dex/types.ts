// Common enums and interfaces for DEX analytics
import type { IDBWalletType } from '@onekeyhq/kit-bg/src/dbs/local/types';

export enum EEnterWay {
  HomeTab = 'HomeTab',
  Search = 'Search',
  Link = 'Link',
  Others = 'Others',
  ExtensionPopup = 'ExtensionPopup',
  ExtensionSidePanel = 'ExtensionSidePanel',
  SwapPro = 'SwapPro',
  BannerList = 'BannerList',
  // Swap's stock trade page, "view full data in Markets".
  SwapStock = 'SwapStock',
  // A row of a Market home list (token, stock, top coins or watchlist).
  MarketList = 'MarketList',
  // A row of the watchlist sidebar on Market detail.
  WatchlistSidebar = 'WatchlistSidebar',
  // Switching assets from inside Market detail (selector, top coins strip).
  DetailSwitch = 'DetailSwitch',
  // An asset row of the Market Highlights page.
  Highlights = 'Highlights',
  // A Market row of the desktop tray menu (watchlist, assets).
  DesktopTray = 'DesktopTray',
}

// Analytics-only list context for detail entries whose route has no
// `marketTokenCategory` (stock lists, watchlist lists).
export enum EMarketEntryCategory {
  Stocks = 'stocks',
  Watchlist = 'watchlist',
}

export enum EDexListName {
  Trending = 'Trending',
  Watchlist = 'Watchlist',
}

export enum ESortWay {
  Liquidity = 'liquidity',
  Volume = 'v24hUSD',
  MC = 'mc',
  Default = 'default',
}

export enum ECopyFrom {
  Homepage = 'Homepage',
  Detail = 'Detail',
  Search = 'Search',
  Others = 'Others',
  BannerList = 'BannerList',
}

export enum EVisitTarget {
  OfficialWebsite = 'OfficialWebsite',
  X = 'X',
  SearchOnX = 'SearchOnX',
}

export enum ESwapType {
  Buy = 'Buy',
  Sell = 'Sell',
}

export enum EAmountEnterType {
  Preset1 = '1',
  Preset2 = '2',
  Preset3 = '3',
  Preset4 = '4',
  Manual = 'Manual',
}

export enum ESlippageSetting {
  Auto = 'Auto',
  Manual = 'Manual',
}

export enum EWatchlistFrom {
  Homepage = 'Homepage',
  Detail = 'Detail',
  Search = 'Search',
  Recommend = 'Recommend',
  Others = 'Others',
  BannerList = 'BannerList',
}

export enum ERouter {
  OKX = 'OKX',
}

export enum ETabSelect {
  Transactions = 'Transactions',
  Portfolio = 'Portfolio',
  Holders = 'Holders',
}

export enum ETVIntervalSelect {
  OneMin = '1m',
  FifteenMin = '15m',
  OneHour = '1h',
  FourHour = '4h',
  Day = 'D',
  Week = 'W',
}

export enum ETVPriceMCSelect {
  Price = 'Price',
  MC = 'MC',
}

// Interface definitions
// The kind of asset a Market detail page shows, taken from the asset itself
// (stock route, top coins category), never from the list it was opened from.
export type IDexDetailKind = 'trending' | 'topCoin' | 'stock';

// Pro chart renderer: the in-app native candles or the TradingView chart.
export type IDexChartMode = 'native' | 'tradingView';

// Chart shown on a Market detail page: the Simple line chart or the Pro chart.
export type IDexChartDisplayMode = 'simple' | 'pro';

// Asset and chart fields shared by the Market detail visit events. Every field
// is optional: an entry reports only what its route already knows.
export interface IDexDetailVisitFields {
  detailKind?: IDexDetailKind;
  tokenSymbol?: string;
  // Network id, e.g. `evm--1`, as in the watchlist events. Missing while
  // the entry has not resolved its asset yet.
  network?: string;
  // Stable Market asset id grouping every chain of the asset: the stock id
  // of a stock detail page, otherwise the Market token id.
  marketAssetId?: string;
  // Persisted chart preferences, not the chart a layout falls back to.
  chartMode?: IDexChartMode;
  chartDisplayMode?: IDexChartDisplayMode;
}

export interface IDexEnterParams extends IDexDetailVisitFields {
  enterWay: EEnterWay;
  // Market list category the detail was opened from, when known.
  marketTokenCategory?: string;
}

export interface IDexLeaveParams extends IDexDetailVisitFields {
  enterWay: EEnterWay;
  // Foreground time spent on the focused detail page.
  durationMs: number;
}

export interface IDexChartModeSwitchParams {
  fromMode: IDexChartMode;
  toMode: IDexChartMode;
  detailKind?: IDexDetailKind;
}

export interface IDexChartDisplayModeSwitchParams {
  fromMode: IDexChartDisplayMode;
  toMode: IDexChartDisplayMode;
  detailKind?: IDexDetailKind;
}

export interface IDexNativeChartIntervalParams {
  // Same values as `tvIntervalSelect`, e.g. `1`, `60`, `1D`.
  intervalSelect: string;
  detailKind?: IDexDetailKind;
}

export interface IDexSimpleChartRangeParams {
  // Simple chart range, e.g. `1H`, `1D`, `1W`, `All`.
  rangeSelect: string;
  detailKind?: IDexDetailKind;
}

export interface IDexListParams {
  // Kept as-is for comparison with older versions: it maps every non-trending
  // tab (including perps) to Watchlist. Read `tabValue` for the actual tab.
  dexListName: EDexListName;
  tabValue?: string;
  // Spot category of the selected tab, e.g. hot, stocks or top coins.
  categoryId?: string;
}

export interface IDexNetworkParams {
  network: string;
}

export interface IDexNetworkLoadingParams {
  network: string;
  tokenLoading: number;
}

export interface IDexAddToWatchlistParams {
  network: string;
  tokenSymbol: string;
  tokenContract: string;
  addFrom: EWatchlistFrom;
}

export interface IDexRemoveFromWatchlistParams {
  network: string;
  tokenSymbol: string;
  tokenContract: string;
  removeFrom: EWatchlistFrom;
}

export interface IDexSortParams {
  sortWay: ESortWay;
  sortDirection?: 'asc' | 'desc';
}

export interface IDexCopyCAParams {
  copyFrom: ECopyFrom;
  copiedContent: string;
}

export interface IDexCheckRiskParams {
  network: string;
  tokenSymbol: string;
  tokenContract: string;
}

export interface IDexVisitSiteParams {
  visitTarget: EVisitTarget;
}

export interface IDexSwapParams {
  walletType: IDBWalletType;
  amountEnterType: EAmountEnterType;
  slippageSetting: ESlippageSetting;
  sourceTokenSymbol: string;
  receivedTokenSymbol: string;
  network: string;
  swapType: ESwapType;
  router: ERouter;
}

export interface IDexBottomTabParams {
  tabSelect: ETabSelect;
}

export interface IDexTVIntervalParams {
  tvIntervalSelect: string;
}

export interface IDexTVLineParams {
  tvLineSelect: string;
}

export interface IDexTVIndicatorParams {
  tvIndicatorSelect: string;
}

export interface IDexTVPriceMCParams {
  tvPriceMCSelect: ETVPriceMCSelect;
}

export interface IDexTVTimeframeParams {
  tvTimeframeSelect: string;
}

export interface IDexBannerEnterParams {
  bannerId: string;
}
