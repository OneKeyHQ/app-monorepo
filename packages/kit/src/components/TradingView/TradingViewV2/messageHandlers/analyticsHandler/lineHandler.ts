import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import type { IMessageHandlerParams } from '../types';

export async function handleAnalyticsLine({
  data,
}: IMessageHandlerParams): Promise<void> {
  // Safely extract analytics line data with proper type checking
  const messageData = data.data;

  if (
    messageData &&
    typeof messageData === 'object' &&
    'TVLineSelect' in messageData
  ) {
    // Extract line property safely
    const safeData = messageData as unknown as Record<string, unknown>;
    const lineSelect = safeData.TVLineSelect as string;

    try {
      // Log to DEX analytics system using existing line method
      defaultLogger.dex.tradingView.dexTVLine({
        tvLineSelect: lineSelect,
      });

      console.log('📊 TradingView line analytics logged:', {
        lineSelect,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to handle analytics line:', error);
    }
  } else {
    console.warn('Invalid line analytics data:', messageData);
  }
}
