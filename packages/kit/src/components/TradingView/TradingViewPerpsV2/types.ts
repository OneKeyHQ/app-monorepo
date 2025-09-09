export interface ITradingMark {
  id: string;
  time: number;
  color: string;
  text: string;
  label: string;
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
  resolution?: string;
  requestId?: string;
}

export interface IGetMarksResponse {
  marks: ITradingMark[];
  requestId?: string;
}

export enum EMarksUpdateOperationEnum {
  INCREMENTAL = 'incremental',
  REPLACE = 'replace',
  CLEAR = 'clear',
}

export interface IMarksUpdateMessage {
  type: 'MARKS_UPDATE';
  payload: {
    marks: ITradingMark[];
    symbol: string;
    operation: EMarksUpdateOperationEnum;
  };
}
