import { ERootRoutes } from '../Root/Routes';
import { ETabHomeRoutes } from '../Root/Tab/Home/Routes';
import { ETabRoutes } from '../Root/Tab/Routes';

import { linkingPathMap } from './path';

export interface IAllowListItem {
  screen: string;
  path?: string;
  exact?: boolean;
}

export type IAllowListItemList = IAllowListItem[];

export const allowList: IAllowListItemList = [
  {
    screen: `${ERootRoutes.Main}/${ETabRoutes.Home}/${ETabHomeRoutes.TabHome}`,
    exact: true,
    path: linkingPathMap.tabHome,
  },
  {
    screen: `${ERootRoutes.Main}/${ETabRoutes.Swap}/${ETabSwapRoutes.TabSwap}`,
    exact: true,
    path: linkingPathMap.tabSwap,
  },
];
