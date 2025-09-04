export interface ITradingMark {
  id: string;
  time: number;
  color: string;
  text: string;
  label: string;
  labelFontColor?: string;
  size?: 'normal' | 'small' | 'large';
  shape?: 'circle' | 'square' | 'arrowUp' | 'arrowDown';
  minSize?: number;
}

export interface ITradeEvent {
  symbol: string;
  side: 'buy' | 'sell';
  size: string;
  price: string;
  time: number;
  txHash?: string;
}

export interface IGetMarksRequest {
  symbol: string;
  from: number;
  to: number;
}

export interface IGetMarksResponse {
  marks: ITradingMark[];
}
