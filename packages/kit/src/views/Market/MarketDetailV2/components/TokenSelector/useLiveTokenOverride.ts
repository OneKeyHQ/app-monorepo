import type { IMarketTokenListLiveOverride } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/MarketTokenListBase';
import { useMarketCurrentTokenLiveDataAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

export function useLiveTokenOverride():
  | IMarketTokenListLiveOverride
  | undefined {
  const [liveData] = useMarketCurrentTokenLiveDataAtom();
  if (!liveData?.networkId || !liveData?.address) {
    return undefined;
  }
  return liveData;
}
