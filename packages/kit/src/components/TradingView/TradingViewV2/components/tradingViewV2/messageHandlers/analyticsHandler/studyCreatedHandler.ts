import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import type { IMessageHandlerParams } from '../types';

export async function handleAnalyticsStudyCreated({
  data,
}: IMessageHandlerParams): Promise<void> {
  // Safely extract analytics study created data with proper type checking
  const messageData = data.data;

  if (
    messageData &&
    typeof messageData === 'object' &&
    'studyName' in messageData
  ) {
    // Extract study properties safely
    const safeData = messageData as unknown as Record<string, unknown>;
    const studyName = safeData.studyName as string;

    try {
      // Log to DEX analytics system using existing indicator method
      defaultLogger.dex.tradingView.dexTVIndicator({
        tvIndicatorSelect: studyName,
      });

      console.log('📊 TradingView study created analytics logged:', {
        studyName,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to handle analytics study created:', error);
    }
  } else {
    console.warn('Invalid study created analytics data:', messageData);
  }
}
