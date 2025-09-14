import { handleAnalyticsInterval } from './intervalHandler';
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
    default:
      console.warn(`Unknown analytics method: ${method}`);
  }
}
