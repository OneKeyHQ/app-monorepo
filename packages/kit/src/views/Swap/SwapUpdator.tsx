import React, { useCallback, useRef } from 'react';

import { useInterval } from '../../hooks';

import { useSwapQuoteCallback, useSwapState } from './hooks/useSwap';

const SwapUpdator = () => {
  const { quoteTime } = useSwapState();
  const ref = useRef<boolean>(false);
  const onSwapQuote = useSwapQuoteCallback();
  const onInterval = useCallback(async () => {
    const now = Date.now();
    if (quoteTime && !ref.current && now - quoteTime >= 14 * 1000) {
      ref.current = true;
      try {
        await onSwapQuote();
      } finally {
        ref.current = false;
      }
    }
  }, [onSwapQuote, quoteTime]);

  useInterval(onInterval, 1000);

  return <></>;
};

export default SwapUpdator;
