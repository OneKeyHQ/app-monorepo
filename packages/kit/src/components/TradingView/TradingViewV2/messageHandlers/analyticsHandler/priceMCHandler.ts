import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import type { IMessageHandlerParams } from '../types';

export async function handleAnalyticsPriceMC({
  data,
}: IMessageHandlerParams): Promise<void> {
  // Safely extract analytics price market cap data with proper type checking
  const messageData = data.data;

  if (
    messageData &&
    typeof messageData === 'object' &&
    'TVPriceMCSelect' in messageData
  ) {
    // Extract price market cap property safely
    const safeData = messageData as unknown as Record<string, unknown>;
    const priceMCSelect = safeData.TVPriceMCSelect as string;

    try {
      // Log to DEX analytics system
      defaultLogger.dex.tradingView.dexTVPriceMC({
        tvPriceMCSelect: priceMCSelect,
      });
    } catch (error) {
      console.error('Failed to handle analytics price MC:', error);
    }
  }
}
