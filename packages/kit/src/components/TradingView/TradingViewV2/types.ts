export interface ITradingViewHistoryData {
  method: string;
  resolution: string;
  from: number;
  to: number;
  firstDataRequest: boolean;
}

export interface ITradingViewLayoutData {
  layout: string; // JSON string format of layout data
}

// Union type to support different data structures
type ITradingViewData = ITradingViewHistoryData | ITradingViewLayoutData;

interface ITradingViewMessage {
  scope: string;
  method: string;
  origin: string;
  data: ITradingViewData;
}

export interface ICustomReceiveHandlerData {
  data: ITradingViewMessage;
}

// Type guard functions
export function isHistoryData(
  data: ITradingViewData,
): data is ITradingViewHistoryData {
  return (
    'method' in data && 'resolution' in data && 'from' in data && 'to' in data
  );
}

export function isLayoutData(
  data: ITradingViewData,
): data is ITradingViewLayoutData {
  return 'layout' in data;
}
