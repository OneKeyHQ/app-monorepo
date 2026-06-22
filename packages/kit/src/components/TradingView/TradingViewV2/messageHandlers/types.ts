import type { IWebViewRef } from '../../../WebView/types';
import type { ITradingViewV2KLineDataFallback } from '../hooks/useTradingViewV2';
import type {
  ICustomReceiveHandlerData,
  ITradingViewKLineDataReadyData,
  ITradingViewKLineLoadErrorData,
  ITradingViewKLinePeriodChangeData,
} from '../types';

export interface IKLineDataRequest {
  method: string;
  resolution: string;
  from: number;
  to: number;
  firstDataRequest: boolean;
}

export interface ILayoutUpdateData {
  layout: string;
}

export interface IMarksTimeRange {
  min: number;
  max: number;
}

export interface IMessageHandlerContext {
  tokenAddress?: string;
  networkId?: string;
  webRef: React.RefObject<IWebViewRef | null>;
  onPanesCountChange?: (count: number) => void;
  accountAddress?: string;
  tokenSymbol?: string;
  marksTimeRange?: React.MutableRefObject<IMarksTimeRange | null>;
  currentKLineResolution?: React.MutableRefObject<string>;
  onCurrentKLineResolutionChange?: (resolution: string) => void;
  forceEmptyKLineData?: boolean;
  emptyKLineDataOnError?: boolean;
  kLineDataFallback?: ITradingViewV2KLineDataFallback;
  primaryKLineDataUnavailable?: boolean;
  onPrimaryKLineDataUnavailable?: () => void;
  onKLineDataReady?: (data: ITradingViewKLineDataReadyData) => void;
  onKLineLoadError?: (data: ITradingViewKLineLoadErrorData) => void;
  onKLinePeriodChange?: (data: ITradingViewKLinePeriodChangeData) => void;
}

export interface IMessageHandlerParams {
  data: ICustomReceiveHandlerData['data'];
  context: IMessageHandlerContext;
}

export type IMessageHandler = (params: IMessageHandlerParams) => Promise<void>;
