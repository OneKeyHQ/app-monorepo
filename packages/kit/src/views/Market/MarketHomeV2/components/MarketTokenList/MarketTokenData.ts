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
  networkLogoUri: string;
  networkId: string;
  firstTradeTime?: number;
  walletInfo?: import('./components/Txns').ITxnsWalletInfo;
  chainId?: string;
  sortIndex?: number;
  isNative?: boolean;
  communityRecognized?: boolean;
}
