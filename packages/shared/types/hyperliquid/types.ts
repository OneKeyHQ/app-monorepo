export interface ConnectionState {
  readonly isConnected: boolean;
  readonly lastConnected: number | null;
  readonly reconnectCount: number;
}

export interface TradingFormData {
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  size: string;
  price: string;
  reduceOnly: boolean;
  takeProfitPrice: string;
  stopLossPrice: string;
}

export interface EnhancedPosition {
  displayPnl: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface TokenDisplayData {
  coin: string;
  lastPrice: string;
  change24h: string;
  change24hPercent: string;
  volume24h: string;
  funding8h: string;
  maxLeverage: number;
}

export interface TokenListItem {
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
