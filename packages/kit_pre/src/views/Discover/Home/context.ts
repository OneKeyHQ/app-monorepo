import { createContext, useContext } from 'react';

import type { MatchDAppItemType } from '../Explorer/explorerUtils';
import type { CategoryType, DAppItemType, GroupDappsType } from '../type';

export type IDiscoverContext = {
  dapps: Record<string, GroupDappsType[]>;
  setDapps: (key: string, items: GroupDappsType[]) => void;
  categories: CategoryType[];
  setCategories: (items: CategoryType[]) => void;
  categoryId: string;
  setCategoryId: (categoryId: string) => void;
  onItemSelect: (item: DAppItemType) => void;
  onItemSelectHistory: (item: MatchDAppItemType) => void;
};

export const DiscoverContext = createContext<IDiscoverContext>({
  dapps: {},
  setDapps: () => {},
  categoryId: '',
  setCategoryId: () => {},
  categories: [],
  setCategories: () => {},
  onItemSelect: () => {},
  onItemSelectHistory: () => {},
});

export const useContextDapps = () => {
  const { categoryId, dapps } = useContext(DiscoverContext);
  return dapps?.[categoryId ?? 'main'] ?? [];
};
