export interface IMarketToken {
  id: string;
  name: string;
  symbol: string;
  address: string;
  decimals: number;
  price: number;
  change24h: number;
  marketCap: number;
  liquidity: number;
  transactions: number;
  uniqueTraders: number;
  holders: number;
  turnover: number;
  tokenImageUri: string;
  tokenImageUris?: string[];
  networkLogoUri: string;
  networkId: string;
  firstTradeTime?: number;
  walletInfo?: import('./components/Txns').ITxnsWalletInfo;
  chainId?: string;
  sortIndex?: number;
  isNative?: boolean;
  communityRecognized?: boolean;
  stock?: import('@onekeyhq/shared/types/marketV2').IMarketStockInfo;
  // Perps watchlist: coin name (e.g. "BTC"). When set, this is a perps token.
  perpsCoin?: string;
  // Perps: max leverage (e.g. 40)
  maxLeverage?: number;
  // Perps: subtitle (e.g. "Tech", "Pre-IPO")
  perpsSubtitle?: string;
}
