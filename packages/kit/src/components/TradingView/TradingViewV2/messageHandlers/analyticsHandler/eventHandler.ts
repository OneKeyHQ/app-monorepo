import { handleAnalyticsInterval } from './intervalHandler';
import { handleAnalyticsLine } from './lineHandler';
import { handleAnalyticsPriceMC } from './priceMCHandler';
import { handleAnalyticsStudyCreated } from './studyCreatedHandler';
import { handleAnalyticsStudyRemoved } from './studyRemovedHandler';
import { handleAnalyticsTimeFrame } from './timeFrameHandler';

import type { IMessageHandlerParams } from '../types';

// Generic analytics event handler that can handle multiple analytics events
export async function handleAnalyticsEvent(
  method: string,
  params: IMessageHandlerParams,
): Promise<void> {
  switch (method) {
    case 'tradingview_analytics_interval':
      return handleAnalyticsInterval(params);
    case 'tradingview_analytics_timeframe':
      return handleAnalyticsTimeFrame(params);
    case 'tradingview_analytics_priceMC':
      return handleAnalyticsPriceMC(params);
    case 'tradingview_analytics_line':
      return handleAnalyticsLine(params);
    case 'tradingview_analytics_studyCreated':
      return handleAnalyticsStudyCreated(params);
    case 'tradingview_analytics_studyRemoved':
      return handleAnalyticsStudyRemoved(params);
    default:
      console.warn(`Unknown analytics method: ${method}`);
  }
}
