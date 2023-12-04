/* eslint-disable @typescript-eslint/no-unsafe-call */
import { getPathFromState as getPathFromStateDefault } from '@react-navigation/core';
import * as Linking from 'expo-linking';
import { merge } from 'lodash';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getExtensionIndexHtml } from '@onekeyhq/shared/src/utils/extUtils';

import { rootConfig } from '../Root/RootNavigator';
import { ERootRoutes } from '../Root/Routes';

import { allowList } from './allowList';

import type { IAllowList, IAllowListItem } from './allowList';
import type { LinkingOptions } from '@react-navigation/native';

const prefix = Linking.createURL('/');

const getScreen = (screen: IAllowListItem['screen']) => {
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

const generateScreenHierarchyRouteConfigList = (list: IAllowList) =>
  list.reduce(
    (prev, tab) =>
      merge(
        prev,
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
  const list = [...allowList];
  list.forEach((item) => {
    item.path = item.path || createPathFromScreen(item.screen);
  });
  return list;
}

const whiteList = buildWhiteList();

const pickConfig = (route: any) => {
  if (Array.isArray(route.children)) {
    return route.children;
  }
  try {
    if (typeof route.component === 'function') {
      console.log(route.component());
      return route.component()?.props?.config;
    }
  } catch (error) {
    return undefined;
  }
  return route?.component?.props?.config;
};

const resolveScreens = (routes: any) =>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  routes // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    ? routes.reduce((prev: any, route: any) => {
        console.log(route.name, route);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        prev[route.name] = {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          exact: !!route.exact,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          path: !!route.reWrite
            ? `REWRITE--${route.reWrite}`
            : route.showPath
            ? route.reWrite || route.name
            : `NOOO_PATH${route.name}`,
        };
        const config = pickConfig(route);
        if (config) {
          prev[route.name].screens = resolveScreens(config);
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return prev;
      }, {})
    : undefined;

const buildLinking = (routes: any): LinkingOptions<any> => {
  // const screenHierarchyConfig =
  //   generateScreenHierarchyRouteConfigList(allowList);
  const screenHierarchyConfig = resolveScreens(routes);
  console.log('screenHierarchyConfig', screenHierarchyConfig);
  return {
    enabled: true,
    prefixes: [prefix],

    /**
     * Only change url at whitelist routes, or return home page
     */
    getPathFromState(state, options) {
      console.log('getPathFromState-', state, options);
      const extHtmlFileUrl = `/${getExtensionIndexHtml()}`;
      /**
       * firefox route issue, refresh cannot recognize hash, just redirect to home page after refresh.
       */
      if (platformEnv.isExtFirefox) {
        return extHtmlFileUrl;
      }
      let newPath = '/';
      const defaultPath = getPathFromStateDefault(state, options);
      const defaultPathWithoutQuery = defaultPath.split('?')[0] || '';
 
      console.log(
        'getPathFromState-defaultPath',
        defaultPath,
        defaultPathWithoutQuery,
      );
      if (defaultPath.includes('NOOO_PATH')) {
        return newPath;
      }

      newPath = defaultPathWithoutQuery;
      if (defaultPath.includes('REWRITE--')) {
        newPath = defaultPath.split('REWRITE--').pop() || '/';
      }
      console.log('REWRITE', newPath);
      // keep manifest v3 url with html file
      if (platformEnv.isExtChrome && platformEnv.isManifestV3) {
        /*
        check chrome.webRequest.onBeforeRequest
         /ui-expand-tab.html/#/   not working for Windows Chrome
         /ui-expand-tab.html#/    works fine
        */
        return `${extHtmlFileUrl}#${newPath}`;
      }
      return newPath;
    },
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
export const LinkingConfig = buildLinking(rootConfig);
