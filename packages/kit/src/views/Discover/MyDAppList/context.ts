import { createContext } from 'react';

import type { MatchDAppItemType } from '../Explorer/explorerUtils';

export type ItemSource = 'Favorites' | 'History';

type MyDAppListContextValue = {
  defaultIndex?: number;
  onItemSelect?: (item: MatchDAppItemType) => Promise<boolean> | void;
};

export const MyDAppListContext = createContext<MyDAppListContextValue>({});
