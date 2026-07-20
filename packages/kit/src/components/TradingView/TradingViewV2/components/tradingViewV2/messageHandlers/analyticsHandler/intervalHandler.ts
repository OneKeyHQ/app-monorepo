import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { normalizeTradingViewKLineInterval } from '../klineDataHandler';

import type { IMessageHandlerParams } from '../types';

export async function handleAnalyticsInterval({
  data,
  context,
}: IMessageHandlerParams): Promise<void> {
  // Safely extract analytics interval data with proper type checking
  const messageData = data.data;

  if (
    messageData &&
    typeof messageData === 'object' &&
    'TVIntervalSelect' in messageData
  ) {
    // Extract interval property safely
    const safeData = messageData as unknown as Record<string, unknown>;
    const interval = safeData.TVIntervalSelect as string;
    const nextPeriod = normalizeTradingViewKLineInterval(interval);
    const previousPeriod = context.currentKLineResolution?.current
      ? normalizeTradingViewKLineInterval(
          context.currentKLineResolution.current,
        )
      : undefined;
    if (previousPeriod) {
      context.onKLinePeriodChange?.({
        fromPeriod: previousPeriod,
        toPeriod: nextPeriod,
      });
    }
    if (context.onCurrentKLineResolutionChange) {
      context.onCurrentKLineResolutionChange(interval);
    } else if (context.currentKLineResolution) {
      context.currentKLineResolution.current = interval;
    }

    try {
      // Log to DEX analytics system
      defaultLogger.dex.tradingView.dexTVInterval({
        tvIntervalSelect: interval,
      });
    } catch (error) {
      console.error('Failed to handle analytics interval:', error);
    }
  }
}
