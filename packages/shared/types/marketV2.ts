export interface IBtcMetadataNextHalving {
  nextHalvingBlockHeight: number;
  blocksUntilHalving: number;
  estimatedSecondsUntilHalving: number;
}

export interface IBtcMetadata {
  marketCap: string;
  circulatingSupply: string;
  remainingSupply: string;
  totalSupply: string;
  fdv: string;
  volume24h: string;
  blockHeight: string;
  blockReward: string;
  nextHalving: IBtcMetadataNextHalving;
  updatedAt: string;
  stale: boolean;
}

export interface IMarketTokenHistoricalPriceFields {
  price5mAgo?: string;
  price1hAgo?: string;
  price4hAgo?: string;
  price24hAgo?: string;
}

export interface IMarketTokenDetail {
  networkId?: string;
  isNative?: boolean;
  address: string;
  logoUrl: string;
  logoUrls?: string[];
  name: string;
  symbol: string;
  decimals: number;
  decimalsResolved?: boolean;
  marketCap?: string;
  fdv?: string;
  tvl?: string;
  liquidity?: string;
  holders?: number;
  circulatingSupply?: string;
  extraData?: {
    website?: string;
    twitter?: string;
  };
  supportSwap?: {
    enable: boolean;
    warningMessage?: string;
  };
  price?: string;
  priceConverted?: string;
  chartPriceUpdatedAt?: number;
  priceChange1mPercent?: string;
  priceChange5mPercent?: string;
  priceChange30mPercent?: string;
  priceChange1hPercent?: string;
  priceChange2hPercent?: string;
  priceChange4hPercent?: string;
  priceChange8hPercent?: string;
  priceChange24hPercent?: string;
  trade1mCount?: string;
  trade5mCount?: string;
  trade30mCount?: string;
  trade1hCount?: string;
  trade2hCount?: string;
  trade4hCount?: string;
  trade8hCount?: string;
  trade24hCount?: string;
  buy1mCount?: string;
  buy5mCount?: string;
  buy30mCount?: string;
  buy1hCount?: string;
  buy2hCount?: string;
  buy4hCount?: string;
  buy8hCount?: string;
  buy24hCount?: string;
  sell1mCount?: string;
  sell5mCount?: string;
  sell30mCount?: string;
  sell1hCount?: string;
  sell2hCount?: string;
  sell4hCount?: string;
  sell8hCount?: string;
  sell24hCount?: string;
  uniqueWallet1m?: string;
  uniqueWallet5m?: string;
  uniqueWallet30m?: string;
  uniqueWallet1h?: string;
  uniqueWallet2h?: string;
  uniqueWallet4h?: string;
  uniqueWallet8h?: string;
  uniqueWallet24h?: string;
  volume1m?: string;
  volume5m?: string;
  volume30m?: string;
  volume1h?: string;
  volume2h?: string;
  volume4h?: string;
  volume8h?: string;
  volume24h?: string;
  volume1hChangePercent?: string;
  volume2hChangePercent?: string;
  volume4hChangePercent?: string;
  volume8hChangePercent?: string;
  volume24hChangePercent?: string;
  vBuy1m?: string;
  vBuy5m?: string;
  vBuy30m?: string;
  vBuy1h?: string;
  vBuy2h?: string;
  vBuy4h?: string;
  vBuy8h?: string;
  vBuy24h?: string;
  vSell1m?: string;
  vSell5m?: string;
  vSell30m?: string;
  vSell1h?: string;
  vSell2h?: string;
  vSell4h?: string;
  vSell8h?: string;
  vSell24h?: string;
  lastUpdated?: number;
  communityRecognized?: boolean;
  stock?: IMarketStockInfo;
  btcMetadata?: IBtcMetadata;
  [key: string]: unknown;
}

export interface IMarketTokenDetailPreview {
  address: string;
  networkId: string;
  isNative?: boolean;
  name: string;
  symbol: string;
  decimals: number;
  price?: number;
  change24h?: number;
  marketCap?: number;
  liquidity?: number;
  holders?: number;
  turnover?: number;
  tokenImageUri?: string;
  tokenImageUris?: string[];
  communityRecognized?: boolean;
  stock?: IMarketStockInfo;
  selectedAt: number;
}

export interface IMarketChain {
  networkId: string;
  name: string;
  logoUrl: string;
  explorerUrl: string;
}

export interface IMarketChainsResponse {
  list: IMarketChain[];
  total: number;
}

export interface IMarketTokenListItemExtraData {
  website?: string;
  twitter?: string;
  [key: string]: unknown;
}

export interface IMarketStockAssetAnalysis {
  volume24h?: string;
  volumeShares?: string;
  turnoverRate?: string;
  avgDailyVolume1y?: string;
  weekHigh52?: string;
  weekLow52?: string;
}

export interface IMarketStockTradingActivity {
  peRatio?: string;
  pbRatio?: string;
  psRatio?: string;
  roe?: string;
  roa?: string;
  netProfitMargin?: string;
  debtToEquity?: string;
  dividendYield?: string;
}

export interface IMarketStockInfo {
  title?: string;
  subtitle: string;
  source?: string;
  sourceLogoUri: string;
  isOpen?: boolean;
  // Localized description from backend (tooltip when open, countdown + tooltip when closed)
  description?: string;
  // Whether trading in the underlying stock is temporarily halted (per-stock signal)
  isPaused?: boolean;
  pausedUpdatedAt?: string;
  assetAnalysis?: IMarketStockAssetAnalysis;
  tradingActivity?: IMarketStockTradingActivity;
  dividendPerShare?: string;
  marketCap?: string;
  sharesOutstanding?: string;
  underlyingAssetTicker?: string;
  underlyingAssetName?: string;
  tokenToAssetRatio?: string;
  analystRatings?: IMarketStockAnalystRatings;
  about?: IMarketStockAbout;
}

export interface IMarketStockAnalystRatings {
  buy: number;
  hold: number;
  sell: number;
  consensus?: 'Buy' | 'Sell';
  updatedAt?: string;
}

export interface IMarketStockAbout {
  description?: string;
  ceo?: string;
  employees?: string;
  exchange?: string;
  ipoDate?: string;
}

export interface IMarketStockDetail {
  ticker: string;
  name: string;
  logoUrl?: string;
  introduction?: string;
  underlyingUpdatedAt?: string;
  stock: IMarketStockInfo;
}

export interface IMarketTokenListItem extends IMarketTokenHistoricalPriceFields {
  address: string;
  logoUrl?: string;
  logoUrls?: string[];
  name: string;
  symbol: string;
  decimals: number;
  marketCap?: string;
  fdv?: string;
  tvl?: string;
  holders?: number;
  extraData?: IMarketTokenListItemExtraData;
  price?: string;
  firstTradeTime?: string;
  priceChange1mPercent?: string;
  priceChange5mPercent?: string;
  priceChange30mPercent?: string;
  priceChange1hPercent?: string;
  priceChange2hPercent?: string;
  priceChange4hPercent?: string;
  priceChange8hPercent?: string;
  priceChange24hPercent?: string;
  trade1mCount?: string;
  trade5mCount?: string;
  trade30mCount?: string;
  trade1hCount?: string;
  trade2hCount?: string;
  trade4hCount?: string;
  trade8hCount?: string;
  trade24hCount?: string;
  buy1mCount?: string;
  buy5mCount?: string;
  buy30mCount?: string;
  buy1hCount?: string;
  buy2hCount?: string;
  buy4hCount?: string;
  buy8hCount?: string;
  buy24hCount?: string;
  sell1mCount?: string;
  sell5mCount?: string;
  sell30mCount?: string;
  sell1hCount?: string;
  sell2hCount?: string;
  sell4hCount?: string;
  sell8hCount?: string;
  sell24hCount?: string;
  uniqueWallet1m?: string;
  uniqueWallet5m?: string;
  uniqueWallet30m?: string;
  uniqueWallet1h?: string;
  uniqueWallet2h?: string;
  uniqueWallet4h?: string;
  uniqueWallet8h?: string;
  uniqueWallet24h?: string;
  volume1m?: string;
  volume5m?: string;
  volume30m?: string;
  volume1h?: string;
  volume2h?: string;
  volume4h?: string;
  volume8h?: string;
  volume24h?: string;
  volume1hChangePercent?: string;
  volume2hChangePercent?: string;
  volume4hChangePercent?: string;
  volume8hChangePercent?: string;
  volume24hChangePercent?: string;
  networkId?: string;
  liquidity?: string;
  chainId?: string;
  communityRecognized?: boolean;
  isNative?: boolean;
  stock?: IMarketStockInfo;
}

export interface IMarketTokenListResponse {
  list: IMarketTokenListItem[];
  total: number;
}

export interface IMarketTokenKLineDataPoint {
  o: number; // open price
  h: number; // high price
  l: number; // low price
  c: number; // close price
  v: number; // volume
  t: number; // timestamp
}

export interface IMarketTokenKLineResponse {
  points: IMarketTokenKLineDataPoint[];
  total: number;
}

export interface IMarketWsPriceData {
  o: number;
  h: number;
  l: number;
  c: number;
  eventType: 'ohlcv';
  type: string;
  unixTime: number;
  v: number;
  symbol: string;
  address: string;
  volUsd?: number;
  confirm?: number;
  dataSource?: string;
}

export type IMarketWsPriceUpdate = Pick<
  IMarketWsPriceData,
  'address' | 'c' | 'unixTime'
> &
  Partial<Omit<IMarketWsPriceData, 'address' | 'c' | 'unixTime'>>;

interface IMarketWsDataUpdateBasePayload {
  tokenAddress: string;
  networkId?: string;
  isSubscriptionAmbiguous?: boolean;
  messageType?: string;
  data: unknown;
  originalData?: unknown;
}

export type IMarketWsDataUpdatePayload =
  | (IMarketWsDataUpdateBasePayload & { channel: 'ohlcv' })
  | (IMarketWsDataUpdateBasePayload & { channel: 'tokenTxs' });

export interface IMarketTokenTransactionToken {
  symbol: string;
  amount: string;
  address: string;
  price: string;
}

export interface IMarketTokenTransaction {
  pairAddress: string;
  hash: string;
  owner: string;
  type: 'buy' | 'sell';
  timestamp: number;
  url: string;
  from: IMarketTokenTransactionToken;
  to: IMarketTokenTransactionToken;
  poolLogoUrl?: string;
  volumeUSD?: number;
}

export interface IMarketTokenTransactionsResponse {
  list: IMarketTokenTransaction[];
  hasMore?: boolean;
  total?: number;
  cursor?: string;
}

export interface IMarketAccountTokenTransactionParty {
  amount: string;
  address: string;
  symbol: string;
}

export interface IMarketAccountTokenTransaction {
  hash: string;
  type: 'buy' | 'sell';
  timestamp: number;
  amount: string;
  from: IMarketAccountTokenTransactionParty;
  to: IMarketAccountTokenTransactionParty;
}

export interface IMarketAccountTokenTransactionsResponse {
  list: IMarketAccountTokenTransaction[];
  hasMore?: boolean;
  total?: number;
  cursor?: string;
}

export interface IMarketTokenHolder {
  accountAddress: string;
  amount: string;
  fiatValue: string;
  /**
   * Percentage of the total token supply that this holder owns. The value is expressed as a string
   * representation of the percentage (e.g. "10.31" to represent 10.31%).
   */
  percentage?: string;
}

export interface IMarketTokenHoldersResponse {
  list: IMarketTokenHolder[];
}

export type IMarketTokenTopLiquidityValue = string | number | null;

export interface IMarketTokenTopLiquidityToken {
  address?: string | null;
  name?: string | null;
  symbol?: string | null;
  tokenSymbol?: string | null;
  tokenAmount?: IMarketTokenTopLiquidityValue;
  logoUrl?: string | null;
  decimals?: number | null;
  [key: string]: unknown;
}

export interface IMarketTokenTopLiquidityItem {
  networkId?: string | null;
  pool?: string | null;
  pairName?: string | null;
  poolName?: string | null;
  pairAddress?: string | null;
  poolAddress?: string | null;
  contractAddress?: string | null;
  dexName?: string | null;
  dexLogoUri?: string | null;
  dexLogoUrl?: string | null;
  protocolName?: string | null;
  protocolLogoUri?: string | null;
  protocolLogoUrl?: string | null;
  liquidity?: IMarketTokenTopLiquidityValue;
  liquidityUsd?: IMarketTokenTopLiquidityValue;
  reserveInUsd?: IMarketTokenTopLiquidityValue;
  tvl?: IMarketTokenTopLiquidityValue;
  liquidityProviderFeePercent?: IMarketTokenTopLiquidityValue;
  liquidityProviderFeeRate?: IMarketTokenTopLiquidityValue;
  feeRate?: IMarketTokenTopLiquidityValue;
  lpFeeRate?: IMarketTokenTopLiquidityValue;
  feePercent?: IMarketTokenTopLiquidityValue;
  lpFeePercent?: IMarketTokenTopLiquidityValue;
  feeBps?: IMarketTokenTopLiquidityValue;
  lpFeeBps?: IMarketTokenTopLiquidityValue;
  tokenAddress?: string | null;
  poolCreator?: string | null;
  liquidityAmount?: IMarketTokenTopLiquidityToken[] | null;
  baseToken?: IMarketTokenTopLiquidityToken | null;
  quoteToken?: IMarketTokenTopLiquidityToken | null;
  [key: string]: unknown;
}

export interface IMarketTokenTopLiquidityResponse {
  list: IMarketTokenTopLiquidityItem[];
}

export interface IMarketTokenBatchListResponse {
  list: IMarketTokenListItem[];
}

export interface IMarketTokenSecurityItem {
  value: boolean | number | string;
  content: string;
  riskType: 'safe' | 'caution' | 'normal' | 'risk';
}

// Simplified token security data - dynamic structure with any security keys
export type IMarketTokenSecurityData = {
  [securityKey: string]: IMarketTokenSecurityItem;
};

export interface IMarketTokenSecurityBatchResponse {
  [tokenAddress: string]: IMarketTokenSecurityData;
}

export interface IMarketBasicConfigNetwork {
  networkId: string;
  index: number;
  name: string;
  logoUrl: string;
  explorerUrl: string;
  chainId: string;
}

export interface IMarketBasicConfigToken {
  contractAddress: string;
  chainId: string;
  isNative: boolean;
  name: string;
  symbol: string;
  logo?: string;
  communityRecognized?: boolean;
}

export interface IMarketBasicConfigNetworkFeature {
  actionBar?: boolean;
  [key: string]: unknown;
}

export interface IMarketBasicConfigFeature {
  marketWebsocket?: {
    transactions?: boolean;
    price?: boolean;
  };
  [key: string]: unknown;
}

export interface IMarketBasicConfigLowLiquidKlineSourceToken {
  networkId: string;
  tokenAddress: string;
}

export interface IMarketBasicConfigHyperLiquidKlineSourceToken {
  networkId: string;
  tokenAddress: string;
  symbol: string;
}

export interface IMarketBasicConfigData {
  tradingViewUrl: string;
  networkList: IMarketBasicConfigNetwork[];
  recommendTokens: IMarketBasicConfigToken[];
  searchRecommendTokens: IMarketBasicConfigToken[];
  refreshInterval: number;
  minLiquidity: number;
  networkFeature?: {
    [networkId: string]: IMarketBasicConfigNetworkFeature;
  };
  feature?: IMarketBasicConfigFeature;
  lowLiquidKlineSourceTokens?: IMarketBasicConfigLowLiquidKlineSourceToken[];
  HyperLiquidKlineSourceTokens?: IMarketBasicConfigHyperLiquidKlineSourceToken[];
  homeTab?: IMarketBasicConfigHomeTab[];
  perpsCategories?: IMarketPerpsCategory[];
  spotCategories?: IMarketSpotCategory[];
  stockCategories?: IMarketStockCategory[];
}

export type IMarketBasicConfigHomeTabType =
  | 'watchlist'
  | 'trending'
  | 'stocks'
  | (string & {});

export interface IMarketBasicConfigHomeTab {
  type: IMarketBasicConfigHomeTabType;
  name: string;
  icon?: string;
}

export type IMarketSpotCategoryType = 'trending' | 'stocks' | (string & {});

export interface IMarketSpotCategory {
  type: IMarketSpotCategoryType;
  name: string;
  icon?: string;
}

export type IMarketStockCategoryId =
  | 'all'
  | 'cons-tech'
  | 'ai-chip'
  | 'index'
  | 'crypto'
  | 'bio'
  | 'energy'
  | 'aero-def'
  | 'materials'
  | 'cn'
  | (string & {});

export interface IMarketStockCategory {
  category: IMarketStockCategoryId;
  name: string;
  tokenCount: number;
}

export type IMarketPerpsCategoryId =
  | 'hot'
  | 'newList'
  | 'crypto'
  | 'stocks'
  | 'metals'
  | 'indices'
  | 'commodities'
  | 'pre-ipo'
  | 'forex'
  | (string & {});

export interface IMarketPerpsCategory {
  /** Unique category identifier from market basic config. */
  categoryId: IMarketPerpsCategoryId;
  /** Localized display name, e.g. "Crypto", "Stocks" */
  name: string;
}

export interface IMarketPerpsTokenFromServer {
  name: string;
  displayName: string;
  maxLeverage: number;
  tokenImageUrl: string;
  markPrice: string;
  prevDayPrice: string;
  change24hPercent: number;
  volume24h: string;
  openInterest: string;
  fundingRate: string;
}

export interface IMarketPerpsTokenListData {
  tokens: IMarketPerpsTokenFromServer[];
  updatedAt: number;
}

export interface IMarketPerpsTokenListResponse {
  code: number;
  message: string;
  data: IMarketPerpsTokenListData;
}

export interface IMarketBasicConfigResponse {
  code: number;
  message: string;
  data: IMarketBasicConfigData;
}

export interface IMarketTokenDetailWebsocket {
  txs: boolean;
  kline: boolean;
}

export interface IMarketPerpsInfo {
  hlTicker: string;
}

export interface IMarketTokenDetailData {
  token: IMarketTokenDetail;
  websocket: IMarketTokenDetailWebsocket;
  perpsInfo?: IMarketPerpsInfo;
}

export interface IMarketTokenDetailResponse {
  code: number;
  message: string;
  data: IMarketTokenDetailData;
}

export interface IMarketAccountPortfolioPnl {
  isPnlSupported: boolean;
  totalPnlUsd: string;
  totalPnlPercent: string;
  unrealizedPnlUsd: string;
  unrealizedPnlPercent: string;
}

export interface IMarketAccountPortfolioItem {
  accountAddress: string;
  tokenAddress: string;
  amount: string;
  symbol: string;
  tokenPrice: string;
  totalPrice: string;
  pnl?: IMarketAccountPortfolioPnl;
}

export interface IMarketAccountPortfolioDisplayItem extends IMarketAccountPortfolioItem {
  networkId?: string;
  tokenId?: string;
  issuer?: string;
  tokenLogoUrl?: string;
  networkLogoUrl?: string;
}

export interface IMarketAccountPortfolioResponse {
  list: IMarketAccountPortfolioItem[];
}

// Banner types
export enum EMarketBannerType {
  Ticker = 'ticker',
  Perps = 'perps',
}

export interface IMarketBannerDescription {
  text: string;
  fontColor: string;
}

export interface IMarketBannerItem {
  _id: string;
  title: string;
  rank: number;
  mode: number;
  payload: string;
  miniBundlerVersion: string;
  backgroundColor: string;
  tokenListId: string;
  description?: IMarketBannerDescription;
  tokenLogos?: string[];
  type?: EMarketBannerType;
}

export interface IMarketBannerListResponse {
  total: number;
  data: IMarketBannerItem[];
}

export interface IMarketBannerTokenListItem extends IMarketTokenListItem {
  isNative?: boolean;
  tokenAge?: string;
}

export interface IMarketBannerTokenListResponse {
  list: IMarketBannerTokenListItem[];
}

export type IMarketStockAssetType = 'stock' | 'etf' | 'index';

export interface IMarketStockPublicItem {
  stockId: string;
  symbol: string;
  name: string;
  logoUrl: string;
  assetType: IMarketStockAssetType;
  price?: string;
  priceChange24hPercent?: string;
  marketCap?: string;
  volume24h?: string;
  peRatio?: string;
  currency: 'USD';
  quoteUpdatedAt?: string;
  sparkline?: number[];
  sparklineUpdatedAt?: string;
}

export type IMarketStockDetailPreview = Pick<
  IMarketStockPublicItem,
  'stockId' | 'symbol' | 'name' | 'logoUrl'
>;

export type IMarketStockPublicListSortBy =
  | 'default'
  | 'price'
  | 'priceChange24hPercent'
  | 'symbol';

export interface IMarketStockPublicListRequest {
  cursor?: string;
  limit?: number;
  category?: string;
  sortBy?: IMarketStockPublicListSortBy;
  sortType?: 'asc' | 'desc';
}

export interface IMarketStockPublicSearchRequest {
  query: string;
  limit?: number;
}

export interface IMarketStockPublicListResponse {
  items: IMarketStockPublicItem[];
  nextCursor?: string;
  total: number;
}

export interface IMarketStockPublicMarketStatus {
  isOpen: boolean;
  session?: string;
  reason?: string | null;
  nextOpenMinutes?: number;
  nextOpenTime?: string;
}

export interface IMarketStockPublicDetail extends IMarketStockPublicItem {
  categories: string[];
  aliases: string[];
  priceChange24hValue?: string;
  marketStatus?: IMarketStockPublicMarketStatus;
  todayHigh?: string;
  todayLow?: string;
  open?: string;
  previousClose?: string;
  amplitude24hPercent?: string;
  weekHigh52?: string;
  weekLow52?: string;
  turnoverRate24h?: string;
  volumeShares?: string;
  averageVolume1y?: string;
  averageVolume30d?: string;
  epsTtm?: string;
  pbRatio?: string;
  psRatio?: string;
  sharesOutstanding?: string;
  dividendYieldTtm?: string;
  dividendPerShareTtm?: string;
  debtToEquityTtm?: string;
  introduction?: string;
  analystRatings?: IMarketStockAnalystRatings;
  about?: IMarketStockAbout;
  // Pending backend support; see stock-detail backend requirements (2026-08-26)
  netIncomeFy?: string;
  revenueFy?: string;
  sharesFloat?: string;
  beta1y?: string;
  // Raw provider payload the endpoint passes through untouched. Only the
  // analyst rating buckets are typed here; everything else stays opaque.
  underlyingMeta?: {
    analystRatingsStrongBuy?: string;
    analystRatingsBuy?: string;
    analystRatingsHold?: string;
    analystRatingsSell?: string;
    analystRatingsStrongSell?: string;
  } & Record<string, unknown>;
}

export type IMarketStockPublicChartPeriod = '1h' | '1d' | '1w' | '1y' | 'all';

export interface IMarketStockPublicChartPoint {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  t: number;
}

export interface IMarketStockPublicChartResponse {
  stockId: string;
  period: IMarketStockPublicChartPeriod;
  currency: 'USD';
  points: IMarketStockPublicChartPoint[];
}

export interface IMarketStockNewsItem {
  id: string;
  title: string;
  summary?: string;
  source: string;
  publishedAt: string;
  url: string;
  imageUrl?: string;
  symbols: string[];
}

export interface IMarketStockNewsResponse {
  stockId: string;
  items: IMarketStockNewsItem[];
  updatedAt: string;
}

export type IMarketStockEventType =
  | 'cash_dividend'
  | 'stock_split'
  | 'earnings';

export type IMarketStockEventStatus = 'confirmed' | 'scheduled';

export interface IMarketStockEvent {
  id: string;
  type: IMarketStockEventType;
  title: string;
  description?: string;
  date: string;
  status: IMarketStockEventStatus;
  metadata?: Record<string, string | number | null>;
}

export interface IMarketStockEventsResponse {
  stockId: string;
  items: IMarketStockEvent[];
  updatedAt: string;
}

export interface IMarketStockTokenVariant {
  tokenId: string;
  issuer: string;
  issuerLogoUrl?: string;
  website?: string;
  twitter?: string;
  symbol?: string;
  name?: string;
  logoUrl?: string;
  networkId: string;
  networkName?: string;
  networkLogoUrl?: string;
  contractAddress: string;
  tokenToAssetRatio?: string;
  tradingHours?: {
    days?: string;
    isMarketOpen?: boolean;
    session?: string;
    reason?: string | null;
    nextOpenMinutes?: number;
    nextOpenTime?: string;
    isPaused?: boolean;
    pausedUpdatedAt?: string;
  };
  holders?: string;
  price?: string;
  priceChange24hPercent?: string;
  currency: 'USD';
  marketUpdatedAt?: string;
  status: string;
  tradingEnabled: boolean;
  isPaused?: boolean;
}

export interface IMarketStockTokenVariantsResponse {
  stockId: string;
  items: IMarketStockTokenVariant[];
  defaultTokenId?: string;
}
