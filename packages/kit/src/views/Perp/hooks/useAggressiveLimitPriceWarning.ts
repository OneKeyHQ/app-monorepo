import { useCallback } from 'react';

import {
  type ITradingFormData,
  useActiveTradeInstrumentAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';

import { useGetBboForOrderPrice } from '../../../states/jotai/contexts/hyperliquid/atoms';
import {
  type IAggressiveLimitPriceWarning,
  getAggressiveLimitPriceWarningFromBbo,
} from '../utils/aggressiveLimitPrice';

export function useGetAggressiveLimitPriceWarning() {
  const [activeInstrument] = useActiveTradeInstrumentAtom();
  const getBbo = useGetBboForOrderPrice();

  return useCallback(
    ({
      coin,
      formData,
      side,
      price,
    }: {
      coin?: string;
      formData: ITradingFormData;
      side: 'long' | 'short';
      price?: string;
    }): IAggressiveLimitPriceWarning | undefined => {
      if (activeInstrument.mode !== 'perp') {
        return undefined;
      }
      return getAggressiveLimitPriceWarningFromBbo({
        coin: coin ?? activeInstrument.coin,
        side,
        type: formData.type,
        orderMode: formData.orderMode,
        limitPrice: price ?? formData.price,
        limitTif: formData.limitTif,
        bboPriceMode: formData.bboPriceMode,
        bbo: getBbo(),
      });
    },
    [activeInstrument.coin, activeInstrument.mode, getBbo],
  );
}
