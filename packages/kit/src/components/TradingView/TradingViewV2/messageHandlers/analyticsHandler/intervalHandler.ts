import type { IMessageHandlerParams } from '../types';

export async function handleAnalyticsInterval({
  data,
}: IMessageHandlerParams): Promise<void> {
  // Safely extract analytics interval data with proper type checking
  const messageData = data.data;

  if (
    messageData &&
    typeof messageData === 'object' &&
    'interval' in messageData
  ) {
    // Extract interval property safely
    const safeData = messageData as unknown as Record<string, unknown>;
    const interval = safeData.interval as number;

    try {
      // Handle analytics interval logic here
      console.log('TradingView analytics interval received:', interval);
    } catch (error) {
      console.error('Failed to handle analytics interval:', error);
    }
  }
}
