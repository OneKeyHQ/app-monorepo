import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { ETVPriceMCSelect } from '@onekeyhq/shared/src/logger/scopes/dex/types';

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
    const priceMCSelectValue = safeData.TVPriceMCSelect as string;

    // Validate that the value is a valid ETVPriceMCSelect enum value
    if (
      priceMCSelectValue === ETVPriceMCSelect.Price ||
      priceMCSelectValue === ETVPriceMCSelect.MC
    ) {
      const priceMCSelect = priceMCSelectValue as ETVPriceMCSelect;

      try {
        // Log to DEX analytics system
        defaultLogger.dex.tradingView.dexTVPriceMC({
          tvPriceMCSelect: priceMCSelect,
        });
      } catch (error) {
        console.error('Failed to handle analytics price MC:', error);
      }
    } else {
      console.warn('Invalid TVPriceMCSelect value:', priceMCSelectValue);
    }
  }
}
