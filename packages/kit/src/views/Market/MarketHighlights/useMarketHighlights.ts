import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useLocaleVariant } from '@onekeyhq/kit/src/hooks/useLocaleVariant';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

export function useMarketHighlights() {
  const locale = useLocaleVariant();
  const { result, isLoading, run } = usePromiseResult(
    async () => ({
      locale,
      items:
        await backgroundApiProxy.serviceMarketV2.fetchMarketHighlights(locale),
    }),
    [locale],
    {
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 30 }),
      runImmediatelyOnMount: true,
      keepResultIfError: true,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      watchLoading: true,
    },
  );
  return {
    items: result?.locale === locale ? result.items : undefined,
    isLoading,
    retry: run,
  };
}
