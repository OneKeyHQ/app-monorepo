export interface IMarketToken {
  id: string;
  name: string;
  symbol: string;
  address: string;
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
  walletInfo?: import('./components/Txns').ITxnsWalletInfo;
  chainId?: string;
  sortIndex?: number;
}
