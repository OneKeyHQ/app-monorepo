import { createContext, useContext } from 'react';

import type { MatchDAppItemType } from '../Explorer/explorerUtils';
import type {
  BannerType,
  CategoryType,
  DAppItemType,
  GroupDappsType,
} from '../type';
import type { TabName } from './type';

export type IDiscoverContext = {
  tabName?: TabName;
  setTabName?: (item: TabName) => void;
  groupDapps: GroupDappsType[];
  setGroupDapps: (items: GroupDappsType[]) => void;
  banners: BannerType[];
  setBanners: (items: BannerType[]) => void;
  dapps: Record<string, DAppItemType[]>;
  setDapps: (key: string, items: DAppItemType[]) => void;
  categories: CategoryType[];
  setCategories: (items: CategoryType[]) => void;
  categoryId: string;
  setCategoryId: (categoryId: string) => void;
  onItemSelect: (item: DAppItemType) => void;
  onItemSelectHistory: (item: MatchDAppItemType) => void;
};

export const DiscoverContext = createContext<IDiscoverContext>({
  groupDapps: [],
  setGroupDapps: () => {},
  banners: [],
  setBanners: () => {},
  dapps: {},
  setDapps: () => {},
  categoryId: '',
  setCategoryId: () => {},
  categories: [],
  setCategories: () => {},
  onItemSelect: () => {},
  onItemSelectHistory: () => {},
});

export const useContextCategoryDapps = () => {
  const { dapps, categoryId } = useContext(DiscoverContext);
  return { data: dapps[categoryId] ?? [], loading: !dapps[categoryId] };
};

export const useGroupDapps = () => {
  const { groupDapps } = useContext(DiscoverContext);
  return groupDapps;
};

export const useBanners = () => {
  const { banners } = useContext(DiscoverContext);
  return banners;
};

export const useCategories = () => {
  const { categories } = useContext(DiscoverContext);
  return categories;
};
