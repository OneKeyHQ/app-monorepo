import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ERootRoutes } from '../enum';
import { EGalleryRoutes } from '../Tab/Developer/Gallery/routes';
import { ETabHomeRoutes } from '../Tab/Home/router';
import { ETabSwapRoutes } from '../Tab/Swap/type';
import { ETabRoutes } from '../Tab/type';

interface IAllowSettingItem {
  /** whether to show URL parameters, it is false in default. */
  showParams: boolean;
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
    [pagePath`${ERootRoutes.Main}${ETabRoutes.Home}${ETabHomeRoutes.TabHomeStack1}`]:
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
  } as Record<string, IAllowSettingItem>;
};
