import { useLayoutEffect } from 'react';
import type { MutableRefObject } from 'react';

export function usePublishSwapStockQuoteReadiness({
  readinessEpoch,
  readyForQuote,
  readyForQuoteRef,
  resetQuote,
  setReadyForQuote,
}: {
  readinessEpoch: number;
  readyForQuote: boolean;
  readyForQuoteRef: MutableRefObject<boolean>;
  resetQuote: () => void | Promise<void>;
  setReadyForQuote: (ready: boolean) => void;
}) {
  useLayoutEffect(() => {
    const wasReadyForQuote = readyForQuoteRef.current;
    readyForQuoteRef.current = readyForQuote;
    setReadyForQuote(readyForQuote);
    if (wasReadyForQuote && !readyForQuote) {
      void resetQuote();
    }

    return () => {
      setReadyForQuote(false);
    };
  }, [
    readinessEpoch,
    readyForQuote,
    readyForQuoteRef,
    resetQuote,
    setReadyForQuote,
  ]);
}
