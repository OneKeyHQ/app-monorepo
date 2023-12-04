import { ERootRoutes } from '../enum';
import { ETabHomeRoutes } from '../Tab/Home/Routes';
import { ETabRoutes } from '../Tab/Routes';
import { ETabSwapRoutes } from '../Tab/Swap/Routes';

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
