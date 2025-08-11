import type { IWebViewRef } from '../../../WebView/types';
import type { ICustomReceiveHandlerData } from '../types';

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

export interface IMessageHandlerContext {
  tokenAddress?: string;
  networkId?: string;
  webRef: React.RefObject<IWebViewRef | null>;
  onPanesCountChange?: (count: number) => void;
}

export interface IMessageHandlerParams {
  data: ICustomReceiveHandlerData['data'];
  context: IMessageHandlerContext;
}

export type IMessageHandler = (params: IMessageHandlerParams) => Promise<void>;
