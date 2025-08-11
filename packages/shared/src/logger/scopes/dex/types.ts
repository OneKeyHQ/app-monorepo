// Common enums and interfaces for DEX analytics

export enum EEnterWay {
  HomeTab = 'HomeTab',
  Search = 'Search',
  Link = 'link',
  Others = 'others',
}

export enum EDexListName {
  Trending = 'Trending',
  Watchlist = 'watchlist',
}

export enum ESortWay {
  Liquidity = 'Liquidity',
  Volume = 'volume',
  MC = 'MC',
}

export enum ECopyFrom {
  Homepage = 'Homepage',
  Detail = 'detail',
  Others = 'others',
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

export enum EWalletType {
  HD = 'HD',
  Hardware = 'Hardware',
  Watch = 'Watch',
}

export enum EAmountEnterType {
  Preset1 = '1',
  Preset2 = '2',
  Preset3 = '3',
  Preset4 = '4',
  Manual = 'manual',
}

export enum ESlippageSetting {
  Auto = 'auto',
  Manual = 'manual',
}

export enum EAddFrom {
  Homepage = 'Homepage',
  Detail = 'detail',
  Onboard = 'onboard',
  Search = 'Search',
  Others = 'others',
}

export enum ERemoveFrom {
  Homepage = 'Homepage',
  Detail = 'detail',
  Search = 'Search',
  Others = 'others',
}

export enum ERouter {
  OKX = 'OKX',
}

export enum EIntervalSelect {
  OneHour = '1h',
  FourHour = '4h',
  EightHour = '8h',
  TwentyFourHour = '24h',
}

export enum ETabSelect {
  Transactions = '交易数',
  Holders = '持有者',
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
export interface IDexEnterParams {
  enterWay: EEnterWay;
}

export interface IDexListParams {
  dexListName: EDexListName;
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
  addFrom: EAddFrom;
}

export interface IDexRemoveFromWatchlistParams {
  network: string;
  tokenSymbol: string;
  tokenContract: string;
  removeFrom: ERemoveFrom;
}

export interface IDexSortParams {
  sortWay: ESortWay;
}

export interface IDexCopyCAParams {
  copyFrom: ECopyFrom;
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
  walletType: EWalletType;
  amountEnterType: EAmountEnterType;
  slippageSetting: ESlippageSetting;
  sourceTokenSymbol: string;
  receivedTokenSymbol: string;
  network: string;
  swapType: ESwapType;
  router: ERouter;
}

export interface IDexIntervalParams {
  intervalSelect: EIntervalSelect;
}

export interface IDexButtonTabParams {
  tabSelect: ETabSelect;
}

export interface IDexTVIntervalParams {
  tvIntervalSelect: ETVIntervalSelect;
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
