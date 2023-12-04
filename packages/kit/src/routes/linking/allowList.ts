import { ERootRoutes } from '../enum';
import { ETabHomeRoutes } from '../Tab/Home/Routes';
import { ETabRoutes } from '../Tab/Routes';

interface IAllowSettingItem {
  path: string[];
  showParams: boolean;
}

export interface IAllowListItem {
  path: string;
  showParams: boolean;
}

export type IAllowList = IAllowListItem[];

const basicAllowList: IAllowSettingItem[] = [
  {
    // Fill in the route name in the order of the route stack
    path: [ERootRoutes.Main, ETabRoutes.Home, ETabHomeRoutes.TabHomeStack1],
    showParams: true,
  },
];

export const allowList: IAllowList = basicAllowList.map(
  ({ path, ...props }) => ({
    path: `/${path.join('/')}`,
    ...props,
  }),
);
