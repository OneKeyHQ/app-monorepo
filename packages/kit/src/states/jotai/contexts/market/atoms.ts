import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { createJotaiContext } from '@onekeyhq/kit/src/states/jotai/utils/createJotaiContext';
import type { IMarketWatchListData } from '@onekeyhq/shared/types/market';

const {
  Provider: ProviderJotaiContextMarketWatchList,
  contextAtom,
  contextAtomMethod,
} = createJotaiContext();
export { ProviderJotaiContextMarketWatchList, contextAtomMethod };

export const { atom: marketWatchListAtom, use: useMarketWatchListAtom } =
  contextAtom<IMarketWatchListData>({ data: [] });

marketWatchListAtom().onMount = async (set) => {
  const data =
    await backgroundApiProxy.simpleDb.marketWatchList.getMarketWatchList();
  set(data);
};
