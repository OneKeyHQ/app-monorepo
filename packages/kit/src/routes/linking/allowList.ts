import { ERootRoutes } from '../Root/Routes';
import { ETabHomeRoutes } from '../Root/Tab/Home/Routes';
import { ETabRoutes } from '../Root/Tab/Routes';
import { ETabSwapRoutes } from '../Root/Tab/Swap/Routes';

import { linkingPathMap } from './path';

export interface IAllowListItem {
  screen: string;
  path?: string;
  exact?: boolean;
}

export type IAllowList = IAllowListItem[];

export const allowList: IAllowList = [
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
