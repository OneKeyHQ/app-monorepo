import type { MatchDAppItemType } from '../Explorer/explorerUtils';
import type { DAppItemType } from '../type';

export interface DiscoverProps {
  onItemSelect: (item: DAppItemType) => void;
  onItemSelectHistory: (item: MatchDAppItemType) => void;
}

export enum TabName {
  Featured = 'Featured',
  Explore = 'Explore',
  Favorites = 'Favorites',
}
