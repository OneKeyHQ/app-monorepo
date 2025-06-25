interface ITradingViewHistoryData {
  method: string;
  resolution: string;
  from: number;
  to: number;
  firstDataRequest: boolean;
}

interface ITradingViewMessage {
  scope: string;
  method: string;
  origin: string;
  data: ITradingViewHistoryData;
}

interface ICustomReceiveHandlerData {
  data: ITradingViewMessage;
}
