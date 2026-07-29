import { useCallback, useRef } from 'react';

import {
  type ITradingFormData,
  useActiveTradeInstrumentAtom,
  useBboForOrderPrice,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';

import {
  type IAggressiveLimitPriceWarning,
  getAggressiveLimitPriceWarningFromBbo,
} from '../utils/aggressiveLimitPrice';

export function useGetAggressiveLimitPriceWarning() {
  const [activeInstrument] = useActiveTradeInstrumentAtom();
  const bbo = useBboForOrderPrice(activeInstrument.mode === 'perp');
  const bboRef = useRef(bbo);
  bboRef.current = bbo;

  return useCallback(
    ({
      formData,
      side,
      price,
    }: {
      formData: ITradingFormData;
      side: 'long' | 'short';
      price?: string;
    }): IAggressiveLimitPriceWarning | undefined => {
      if (activeInstrument.mode !== 'perp') {
        return undefined;
      }
      return getAggressiveLimitPriceWarningFromBbo({
        coin: activeInstrument.coin,
        side,
        type: formData.type,
        orderMode: formData.orderMode,
        limitPrice: price ?? formData.price,
        limitTif: formData.limitTif,
        bboPriceMode: formData.bboPriceMode,
        bbo: bboRef.current,
      });
    },
    [activeInstrument.coin, activeInstrument.mode],
  );
}
