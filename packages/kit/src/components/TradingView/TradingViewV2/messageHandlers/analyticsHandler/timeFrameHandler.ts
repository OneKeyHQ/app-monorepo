import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import type { IMessageHandlerParams } from '../types';

export async function handleAnalyticsTimeFrame({
  data,
}: IMessageHandlerParams): Promise<void> {
  // Safely extract analytics time frame data with proper type checking
  const messageData = data.data;

  if (
    messageData &&
    typeof messageData === 'object' &&
    'TVTimeframeSelect' in messageData
  ) {
    // Extract time frame property safely
    const safeData = messageData as unknown as Record<string, unknown>;
    const timeFrame = safeData.TVTimeframeSelect as string;

    try {
      // Log to DEX analytics system
      defaultLogger.dex.tradingView.dexTVTimeFrame({
        tvTimeframeSelect: timeFrame,
      });
    } catch (error) {
      console.error('Failed to handle analytics time frame:', error);
    }
  }
}
