import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useLocaleVariant } from '@onekeyhq/kit/src/hooks/useLocaleVariant';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketHighlight } from '@onekeyhq/shared/types/marketV2';

import { getNativeTokenInfo } from '../MarketHomeV2/components/MarketTokenList/utils/tokenListHelpers';

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
  const items = useMemo(() => {
    if (result?.locale !== locale) return undefined;
    return result.items.map((item) => ({
      ...item,
      assets: item.assets.map((asset) => {
        if (asset.type !== 'token') return asset;
        const { isNative } = getNativeTokenInfo(
          asset.isNative ?? asset.favorite.isNative,
          asset.contractAddress,
        );
        return {
          ...asset,
          isNative,
          favorite: { ...asset.favorite, isNative },
        };
      }),
    }));
  }, [locale, result]);
  return {
    items,
    isLoading,
    retry: run,
  };
}
