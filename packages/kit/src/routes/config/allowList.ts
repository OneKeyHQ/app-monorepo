import { createURL } from 'expo-linking';

import { ERootRoutes } from '../enum';
import { ETabHomeRoutes } from '../Tab/Home/Routes';
import { ETabRoutes } from '../Tab/Routes';

interface IAllowSettingItem {
  showParams: boolean;
}
export const routerPrefix = createURL('/');

function path(_: TemplateStringsArray, ...paths: string[]): string {
  return routerPrefix + paths.join('/');
}

export const allowList: Record<string, IAllowSettingItem> = {
  // fill in the route name as the key according to the route stack order
  // /main/tab-Home/TabHomeStack1
  [path`${ERootRoutes.Main}${ETabRoutes.Home}${ETabHomeRoutes.TabHomeStack1}`]:
    {
      showParams: true,
    },
};
