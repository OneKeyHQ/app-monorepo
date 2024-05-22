import type { IIUniversalRecentSearchItem } from '@onekeyhq/shared/types/search';

import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export type IUniversalSearchAtom = {
  recentSearch: IIUniversalRecentSearchItem[];
};

export const {
  target: universalSearchPersistAtom,
  use: useUniversalSearchPersistAtom,
} = globalAtom<IUniversalSearchAtom>({
  persist: true,
  name: EAtomNames.universalSearchPersistAtom,
  initialValue: {
    recentSearch: [],
  },
});
