import { getPathFromState as getPathFromStateDefault } from '@react-navigation/core';
import * as Linking from 'expo-linking';
import { merge } from 'lodash';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getExtensionIndexHtml } from '@onekeyhq/shared/src/utils/extUtils';

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

const buildLinking = (): LinkingOptions<any> => {
  const screenHierarchyConfig =
    generateScreenHierarchyRouteConfigList(allowList);
  return {
    enabled: true,
    prefixes: [prefix],

    /**
     * Only change url at whitelist routes, or return home page
     */
    getPathFromState(state, options) {
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
      const isAllowPath = whiteList.some(
        (item) =>
          defaultPathWithoutQuery && item.path === defaultPathWithoutQuery,
      );
      if (isAllowPath) {
        newPath = defaultPath;
      }
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
