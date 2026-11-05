import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useLocaleVariant } from '@onekeyhq/kit/src/hooks/useLocaleVariant';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketHighlight } from '@onekeyhq/shared/types/marketV2';

export type IMarketHighlightsPreview = {
  locale: string;
  items: IMarketHighlight[];
};

export function useMarketHighlights(initialResult?: IMarketHighlightsPreview) {
  const locale = useLocaleVariant();
  const { result, isLoading, run } = usePromiseResult(
    async () => ({
      locale,
      items:
        await backgroundApiProxy.serviceMarketV2.fetchMarketHighlights(locale),
    }),
    [locale],
    {
      initResult: initialResult,
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
