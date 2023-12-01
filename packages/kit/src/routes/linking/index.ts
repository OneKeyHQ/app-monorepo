import { getPathFromState as getPathFromStateDefault } from '@react-navigation/core';
import * as Linking from 'expo-linking';
import { merge } from 'lodash';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ERootRoutes } from '../Root/Routes';
import { ETabRoutes } from '../Root/Tab/Routes';

import { buildAppRootTabName } from './utils';

import type { LinkingOptions } from '@react-navigation/native';
import { linkingPathMap } from './path';

const prefix = Linking.createURL('/');

type WhiteListItem = {
  screen: string;
  path?: string;
  exact?: boolean;
};

type WhiteListItemList = WhiteListItem[];

function buildAppRootTabScreen(tabName: ETabRoutes) {
  return `${ERootRoutes.Main}/Tab/${tabName}/${buildAppRootTabName(tabName)}`;
}

export const normalRouteWhiteList: WhiteListItemList = [
  {
    screen: buildAppRootTabScreen(ETabRoutes.Home),
    exact: true,
    path: linkingPathMap.tabHome,
  },
];

const getScreen = (screen: WhiteListItem['screen']) => {
  if (typeof screen === 'string') {
    return screen;
  }
  return screen;
};

function createPathFromScreen(screen: string) {
  return `/${screen}`;
}

/**
 * split white list config and generate hierarchy config for react-navigation linking config
 */
const generateScreenHierarchyRouteConfig = ({
  screenListStr,
  path,
  exact,
  fullPath,
}: {
  screenListStr: string;
  path?: string;
  exact?: boolean;
  fullPath?: string;
}): Record<string, any> => {
  const screens = screenListStr.split('/').filter(Boolean);
  let pathStr = path;
  if (!pathStr && screenListStr) {
    pathStr = createPathFromScreen(screenListStr);
  }
  const pathList = (pathStr || '').split('/').filter(Boolean);
  if (!screens.length || (!pathList.length && !exact)) {
    return {};
  }

  const currentRoute = screens[0];
  const currentPath = pathList[0] || currentRoute;

  const isLastScreen = screens.length === 1;
  const isExactUrl = Boolean(isLastScreen && exact);
  console.log(isExactUrl, fullPath, currentPath);
  return {
    [currentRoute]: {
      path: isExactUrl ? fullPath : `/${currentPath}`,
      exact: isExactUrl,
      screens: generateScreenHierarchyRouteConfig({
        screenListStr: screens.slice(1).join('/'),
        path: pathList.slice(1).join('/'),
        fullPath,
        exact,
      }),
    },
  };
};

const generateScreenHierarchyRouteConfigList = (
  whiteListConfig: WhiteListItemList,
) =>
  whiteListConfig.reduce(
    (memo, tab) =>
      merge(
        memo,
        generateScreenHierarchyRouteConfig({
          screenListStr: getScreen(tab.screen),
          path: tab.path,
          exact: tab.exact,
          fullPath: tab.path,
        }),
      ),
    {},
  );

function buildWhiteList() {
  const list = [...normalRouteWhiteList];
  list.forEach((item) => {
    item.path = item.path || createPathFromScreen(item.screen);
  });
  return list;
}

const buildLinking = (): LinkingOptions<any> => {
  const screenHierarchyConfig =
    generateScreenHierarchyRouteConfigList(normalRouteWhiteList);
  return {
    enabled: true,
    prefixes: [prefix],
    config: {
      initialRouteName: ERootRoutes.Main,
      screens: {
        ...screenHierarchyConfig,
        // custom route with path params needs to be defined at last
        NotFound: '*',
      },
    },
  };
};

export default buildLinking;
