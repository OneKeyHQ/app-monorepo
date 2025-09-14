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
      // Handle analytics time frame logic here
      console.log('TradingView analytics time frame received:', timeFrame);
    } catch (error) {
      console.error('Failed to handle analytics time frame:', error);
    }
  }
}
