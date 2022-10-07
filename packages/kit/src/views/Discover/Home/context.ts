import { createContext } from 'react';

import { MatchDAppItemType } from '../Explorer/explorerUtils';
import { DAppItemType } from '../type';

export type ItemSource = 'Favorites' | 'History';

type DiscoverContextValue = {
  itemSource: ItemSource;
  setItemSource: (source: ItemSource) => void;
  categoryId: string;
  setCategoryId: (categoryId: string) => void;
  onItemSelect: (item: DAppItemType) => void;
  onItemSelectHistory: (item: MatchDAppItemType) => void;
};

export const DiscoverContext = createContext<DiscoverContextValue>({
  itemSource: 'Favorites',
  categoryId: '',
  setCategoryId: () => {},
  setItemSource: () => {},
  onItemSelect: () => {},
  onItemSelectHistory: () => {},
});
