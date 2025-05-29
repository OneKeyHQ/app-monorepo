import type { IRiskIndicatorType } from './components/RiskIndicator';

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
  tokenAge: string;
  audit: IRiskIndicatorType;
  tokenImageUri: string;
  networkLogoUri: string;
  walletInfo?: import('./components/Txns').ITxnsWalletInfo;
}
