import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EExportTimeRange } from '@onekeyhq/shared/src/referralCode/type';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

export function usePerpsCumulativeRewards() {
  const { result, isLoading, run } = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceReferralCode.getPerpsCumulativeRewards({
        timeRange: EExportTimeRange.All,
      }),
    [],
    {
      initResult: undefined,
      pollingInterval: timerUtils.getTimeDurationMs({ minute: 1 }),
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      undefinedResultIfError: true,
    },
  );

  return {
    perpsCumulativeRewards: result,
    isLoading,
    refetch: run,
  };
}
