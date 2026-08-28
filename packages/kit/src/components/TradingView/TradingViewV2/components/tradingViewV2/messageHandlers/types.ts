import type { IWebViewRef } from '@onekeyhq/kit/src/components/WebView/types';
import type { IMarketKLineProvider } from '@onekeyhq/shared/types/marketV2';

import type {
  ICustomReceiveHandlerData,
  ITradingViewKLineDataReadyData,
  ITradingViewKLineLoadErrorData,
  ITradingViewKLinePeriodChangeData,
} from '../../../types';
import type { ITradingViewV2KLineDataFallback } from '../hooks/useTradingViewV2';

export interface IKLineDataRequest {
  method: string;
  requestId?: string;
  resolution: string;
  from: number;
  to: number;
  countBack?: number;
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
  kLineProvider?: IMarketKLineProvider;
  kLineProviderSymbol?: string;
  historyStartTime?: number;
  webRef: React.RefObject<IWebViewRef | null>;
  onPanesCountChange?: (count: number) => void;
  accountAddress?: string;
  tokenSymbol?: string;
  marksTimeRange?: React.MutableRefObject<IMarksTimeRange | null>;
  webViewLoadGeneration?: React.MutableRefObject<number>;
  currentKLineResolution?: React.MutableRefObject<string>;
  onCurrentKLineResolutionChange?: (resolution: string) => void;
  isRequestIdentityCurrent?: () => boolean;
  isCurrentKLineRequest?: (request?: {
    symbol?: string;
    tokenAddress?: string;
    networkId?: string;
  }) => boolean;
  forceEmptyKLineData?: boolean;
  emptyKLineDataOnError?: boolean;
  kLineDataFallback?: ITradingViewV2KLineDataFallback;
  primaryKLineDataUnavailable?: boolean;
  onPrimaryKLineDataUnavailable?: () => void;
  isKLineHistoryReady?: boolean;
  onKLineDataReady?: (data: ITradingViewKLineDataReadyData) => void;
  onKLineLoadError?: (data: ITradingViewKLineLoadErrorData) => void;
  onKLinePeriodChange?: (data: ITradingViewKLinePeriodChangeData) => void;
}

export interface IMessageHandlerParams {
  data: ICustomReceiveHandlerData['data'];
  context: IMessageHandlerContext;
}

export type IMessageHandler = (params: IMessageHandlerParams) => Promise<void>;
