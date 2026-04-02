import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { createJotaiContext } from '@onekeyhq/kit/src/states/jotai/utils/createJotaiContext';
import type { IUniversalSearchAtomData } from '@onekeyhq/shared/types/search';

const {
  Provider: ProviderJotaiContextUniversalSearch,
  contextAtom,
  contextAtomMethod,
} = createJotaiContext();
export { ProviderJotaiContextUniversalSearch, contextAtomMethod };

export const { atom: universalSearchAtom, use: useUniversalSearchAtom } =
  contextAtom<IUniversalSearchAtomData>({ recentSearch: [] });

universalSearchAtom().onMount = (set) => {
  void backgroundApiProxy.simpleDb.universalSearch
    .getData()
    .then((data) => set(data));
};
