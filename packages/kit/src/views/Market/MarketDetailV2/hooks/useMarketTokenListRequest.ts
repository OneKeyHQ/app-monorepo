import { useRef, useState } from 'react';

import { useIsMounted } from '@onekeyhq/kit/src/hooks/useIsMounted';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

export function useMarketTokenListRequest<T>(
  request: () => Promise<T>,
  {
    networkId,
    tokenAddress,
    isTabFocused,
  }: {
    networkId: string;
    tokenAddress: string;
    isTabFocused: boolean;
  },
) {
  const [scope, setScope] = useState({ networkId, tokenAddress });
  if (scope.networkId !== networkId || scope.tokenAddress !== tokenAddress) {
    setScope({ networkId, tokenAddress });
  }
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const requestRef = useRef(request);
  requestRef.current = request;
  const isMountedRef = useIsMounted();
  const [failedScope, setFailedScope] = useState<typeof scope>();
  const { result, isLoading, run, setStopPolling } = usePromiseResult(
    async () => {
      try {
        return { scope, data: await requestRef.current() };
      } catch (error) {
        if (isMountedRef.current && scopeRef.current === scope) {
          setFailedScope(scope);
        }
        throw error;
      }
    },
    [scope, isMountedRef],
    {
      watchLoading: true,
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 5 }),
      overrideIsFocused: (isFocused) => isFocused && isTabFocused,
      revalidateOnFocus: true,
    },
  );
  // Reject the previous token's result during render, before focus effects run.
  // Scope identity also distinguishes A -> B -> A while requests are in flight.
  const scopedResult = result?.scope === scope ? result : undefined;

  return {
    scope,
    result: scopedResult?.data,
    isLoading,
    isInitialPending: scopedResult === undefined && failedScope !== scope,
    run,
    setStopPolling,
  };
}
