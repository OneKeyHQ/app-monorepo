export interface IMarketTokenDetail {
  address: string;
  logoUrl: string;
  name: string;
  symbol: string;
  decimals: number;
  marketCap?: string;
  fdv?: string;
  tvl?: string;
  holders?: number;
  extraData?: {
    website?: string;
    twitter?: string;
  };
  price?: string;
  priceChange1hPercent?: string;
  priceChange2hPercent?: string;
  priceChange4hPercent?: string;
  priceChange8hPercent?: string;
  priceChange24hPercent?: string;
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
  trade5mCount?: string;
  trade1hCount?: string;
  trade2hCount?: string;
  trade4hCount?: string;
  trade8hCount?: string;
  trade24hCount?: string;
  buy5mCount?: string;
  buy1hCount?: string;
  buy4hCount?: string;
  buy24hCount?: string;
  sell5mCount?: string;
  sell1hCount?: string;
  sell4hCount?: string;
  sell24hCount?: string;
  volumeBuy5m?: string;
  volumeBuy1h?: string;
  volumeBuy4h?: string;
  volumeBuy24h?: string;
  volumeSell5m?: string;
  volumeSell1h?: string;
  volumeSell4h?: string;
  volumeSell24h?: string;
  [key: string]: unknown;
}

export interface IMarketTokenDetailAttribute {
  labelKey: string;
  value: string;
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

export interface IMarketTokenListItem {
  address: string;
  logoUrl?: string;
  name: string;
  symbol: string;
  decimals: number;
  marketCap?: string;
  fdv?: string;
  tvl?: string;
  holders?: number;
  extraData?: IMarketTokenListItemExtraData;
  price?: string;
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
}

export interface IMarketTokenListResponse {
  list: IMarketTokenListItem[];
  total: number;
}

export interface IMarketTokenKineDataPoint {
  o: number; // open price
  h: number; // high price
  l: number; // low price
  c: number; // close price
  v: number; // volume
  t: number; // timestamp
}

export interface IMarketTokenKineResponse {
  points: IMarketTokenKineDataPoint[];
  total: number;
}

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
}

export interface IMarketTokenTransactionsResponse {
  list: IMarketTokenTransaction[];
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

export interface IMarketTokenBatchListResponse {
  list: IMarketTokenListItem[];
}

export interface IMarketTokenSecurity {
  antiWhaleModifiable: string;
  buyTax: string;
  canTakeBackOwnership: string;
  cannotBuy: string;
  cannotSellAll: string;
  creatorAddress: string;
  creatorBalance: string;
  creatorPercentage: string;
  externalCall: string;
  hiddenOwner: string;
  holderCount: string;
  honeypotWithSameCreator: string;
  isAntiWhale: string;
  isBlacklisted: string;
  isHoneypot: string;
  isInDex: string;
  isMintable: string;
  isOpenSource: string;
  isProxy: string;
  isWhitelisted: string;
  lpHolderCount: string;
  lpHolders: Array<{
    address: string;
    tag: string;
    value: string | null;
    is_contract: number;
    balance: string;
    percent: string;
    NFT_list: any;
    is_locked: number;
  }>;
  lpTotalSupply: string;
  ownerAddress: string;
  ownerBalance: string;
  ownerChangeBalance: string;
  ownerPercentage: string;
  personalSlippageModifiable: string;
  sellTax: string;
  slippageModifiable: string;
  tokenName: string;
  tokenSymbol: string;
  totalSupply: string;
  tradingCooldown: string;
  transferPausable: string;
  trustList: string;
  [key: string]: unknown;
}
