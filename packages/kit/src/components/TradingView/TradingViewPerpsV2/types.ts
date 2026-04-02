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

// ============================================
// Chart Lines Types
// ============================================

export type ITVLineKind =
  | 'liquidation'
  | 'position'
  | 'order'
  | 'tp' // Take Profit (Market/Limit)
  | 'sl'; // Stop Loss (Market/Limit)

export type ITVLineSide = 'long' | 'short';

export interface ITVLine {
  id: string; // liq:<symbol>:<leverageType>, pos:<symbol>:<leverageType>, order:<oid>
  symbol: string;
  kind: ITVLineKind;
  price: string; // Formatted price string
  qty?: string; // Size for position/order
  side?: ITVLineSide; // For styling
  pnlPositive?: boolean; // For position lines: true if profit, false if loss
  label?: {
    left?: string; // e.g., "PNL +$123.45"
    right?: string; // e.g., "+0.5 BTC"
  };
  editable?: boolean; // Only true for limit orders
  meta?: {
    orderId?: string;
    orderType?: string;
    leverageType?: string;
  };
  version: number; // For diff detection
}

export enum ETVLinesOperationEnum {
  SYNC = 'sync',
  PATCH = 'patch',
  CLEAR = 'clear',
}

export interface ITVLinesSyncPayload {
  symbol: string;
  revision: number;
  lines: ITVLine[];
}

export interface ITVLinesPatchPayload {
  symbol: string;
  revision: number;
  add: ITVLine[];
  update: ITVLine[];
  remove: string[]; // Line IDs to remove
}

export interface ITVLinesClearPayload {
  symbol: string;
}

export interface ITVLineEditResultPayload {
  requestId: string;
  ok: boolean;
  error?: string;
  revertPrice?: string;
}

// Iframe -> App messages
export interface ITVLineReadyPayload {
  capabilities?: string[];
}

export interface ITVLineDragCommitPayload {
  lineId: string;
  symbol: string;
  newPrice: string;
  requestId: string;
}

export interface ITVOrderCancelPayload {
  lineId: string;
  symbol: string;
  orderId?: string;
}
