import { useLayoutEffect, useRef } from 'react';

export function useChartOrderContext({
  accountAddress,
  symbol,
  chartInstanceKey,
  onInvalidate,
}: {
  accountAddress: string | undefined;
  symbol: string;
  chartInstanceKey: string;
  onInvalidate: () => void;
}) {
  const generationRef = useRef(0);
  useLayoutEffect(
    () => () => {
      // Cancel pending intents as well as dialogs that are already visible.
      generationRef.current += 1;
      onInvalidate();
    },
    [accountAddress, symbol, chartInstanceKey, onInvalidate],
  );
  return generationRef;
}
