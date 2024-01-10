import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { EGalleryRoutes } from '../../views/Developer/pages/routes';
import { ETabHomeRoutes } from '../../views/Home/router';
import { EModalSettingRoutes } from '../../views/Setting/types';
import { ERootRoutes } from '../enum';
import { EModalRoutes } from '../Modal/type';
import { ETabSwapRoutes } from '../Tab/Swap/type';
import { ETabRoutes } from '../Tab/type';

interface IAllowSettingItem {
  /** whether to show URL parameters, it is false in default. */
  showParams: boolean;
  showUrl?: boolean;
}

export type IScreenPathConfig = Record<
  string,
  {
    path: string;
    exact: boolean;
    screens?: IScreenPathConfig;
  }
>;

const removeExtraSlash = (path: string) => path.replace(/\/+/g, '');
const addPath = (prev: string, path: string) => {
  if (!path) {
    return prev;
  }

  if (!prev) {
    return path;
  }
  if (prev.endsWith('/')) {
    return `${prev}${path}`;
  }
  return `${prev}/${path}`;
};

export const buildAllowList = (screens: IScreenPathConfig) => {
  function pagePath(_: TemplateStringsArray, ...screenNames: string[]): string {
    let screenConfig = screens;
    const path = screenNames.reduce((prev, screenName) => {
      const screen = screenConfig[screenName];
      if (platformEnv.isDev) {
        if (!screen) {
          throw new Error(`screen ${screenName} not found`);
        }
      }
      const nextScreenConfig = screen.screens;
      if (nextScreenConfig) {
        screenConfig = nextScreenConfig;
      }
      const screenPath = removeExtraSlash(screen.path);
      // if the path is rewritten path, the full path will be rewritten.
      return screen.exact ? screenPath : addPath(prev, screenPath);
    }, '');
    return `/${path}`;
  }
  // fill in the route name as the key according to the route stacks order
  // Page: /main/tab-Home/TabHomeStack1
  return {
    [pagePath`${ERootRoutes.Main}${ETabRoutes.Home}${ETabHomeRoutes.TabHome}`]:
      {
        showParams: true,
      },
    // Page: /main/tab-Swap/TabSwap
    // Don't worry, the URL here is virtual, actually /swap.
    // it will automatically find the real route according to the route stacks.
    [pagePath`${ERootRoutes.Main}${ETabRoutes.Swap}${ETabSwapRoutes.TabSwap}`]:
      {
        showParams: true,
      },
    [pagePath`${ERootRoutes.Main}${ETabRoutes.Developer}${EGalleryRoutes.Components}`]:
      {
        showParams: true,
      },
    [pagePath`${ERootRoutes.Modal}${EModalRoutes.SettingModal}${EModalSettingRoutes.SettingListModal}`]:
      {
        showUrl: true,
        showParams: true,
      },
  } as Record<string, IAllowSettingItem>;
};
