// Common enums and interfaces for DEX analytics
import type { IDBWalletType } from '@onekeyhq/kit-bg/src/dbs/local/types';

export enum EEnterWay {
  HomeTab = 'HomeTab',
  Search = 'Search',
  Link = 'Link',
  Others = 'Others',
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
  Others = 'Others',
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
  Others = 'Others',
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
  Transactions = 'Transactions',
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
