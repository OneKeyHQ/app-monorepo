import type { IMessageHandlerParams } from '../types';

export async function handleAnalyticsStudyRemoved({
  data,
}: IMessageHandlerParams): Promise<void> {
  // Safely extract analytics study removed data with proper type checking
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
      // TODO: Implement study removed analytics
      // Log to DEX analytics system using existing indicator method
      // Note: We could track removal differently, but for now use the same indicator tracking
      // defaultLogger.dex.tradingView.dexTVIndicator({
      //   tvIndicatorSelect: `${studyName}_removed`,
      // });

      console.log('📊 TradingView study removed analytics logged:', {
        studyName,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to handle analytics study removed:', error);
    }
  } else {
    console.warn('Invalid study removed analytics data:', messageData);
  }
}
