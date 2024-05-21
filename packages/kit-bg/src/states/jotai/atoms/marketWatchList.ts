import type { IMarketWatchListItem } from '@onekeyhq/shared/types/market';

import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export const {
  target: marketWatchListPersistAtom,
  use: useMarketWatchListPersistAtom,
} = globalAtom<{ items: IMarketWatchListItem[] }>({
  persist: true,
  name: EAtomNames.marketWatchListPersistAtom,
  initialValue: {
    items: [],
  },
});
