import { useCallback, useState } from 'react';

import type { ISwapDefaultConfigStatus } from '../utils/swapColdStartTokenCacheUtils';

export function useSwapDefaultConfigDecision({
  intentKey,
  initialStatusRef,
  networkConfigStatus,
}: {
  intentKey: string | undefined;
  initialStatusRef: { current: ISwapDefaultConfigStatus };
  networkConfigStatus: ISwapDefaultConfigStatus;
}) {
  const [decision, setDecision] = useState<{
    key: string | undefined;
    status?: ISwapDefaultConfigStatus;
  }>(() => ({ key: intentKey }));
  const statusAtEntry =
    networkConfigStatus === 'success' ? 'success' : initialStatusRef.current;
  const currentDecision: typeof decision =
    decision.key === intentKey
      ? decision
      : {
          key: intentKey,
          status: statusAtEntry === 'pending' ? undefined : statusAtEntry,
        };
  if (currentDecision !== decision) {
    // Capture readiness once for a new intent; a late response cannot change it.
    setDecision(currentDecision);
  }
  const getDefaultConfigStatus = useCallback(
    () => currentDecision.status ?? initialStatusRef.current,
    [currentDecision.status, initialStatusRef],
  );
  return {
    defaultConfigStatus: getDefaultConfigStatus(),
    getDefaultConfigStatus,
  };
}
