import { isNil } from 'lodash';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

// Chrome extension popups can have a maximum height of 600px and maximum width of 800px
export const UI_HTML_DEFAULT_MIN_WIDTH = 375;
export const UI_HTML_DEFAULT_MIN_HEIGHT = 600;

export type IOpenUrlRouteInfo = {
  routes: string | string[];
  params?: any;
};

function buildExtRouteUrl(
  htmlFile: string,
  { routes, params = {} }: IOpenUrlRouteInfo,
) {
  /*
  http://localhost:3001/#/modal/DappConnectionModal/ConnectionModal?id=0&origin=https%3A%2F%2Fmetamask.github.io&scope=ethereum&data=%7B%22method%22%3A%22eth_requestAccounts%22%2C%22jsonrpc%22%3A%222.0%22%7D
   */
  const pathStr = ([] as string[]).concat(routes).join('/');
  const paramsStr = new URLSearchParams(params).toString();
  // TODO: white list
  // const exactRoute = normalRouteWhiteList.find(
  //   (route) => route.screen === pathStr && route.exact,
  // );
  // if (exactRoute?.path) {
  //   // use exact path instead of screens if exist
  //   pathStr = exactRoute.path.replace(/^\//g, '');
  // }
  let hash = '';
  if (pathStr || paramsStr) {
    hash = `#/${pathStr || ''}`;
    if (paramsStr) {
      hash = `${hash}?${paramsStr || ''}`;
    }
  }

  return chrome.runtime.getURL(`/${htmlFile}${hash}`);
}

function openUrl(url: string) {
  window.open(url, '_blank');
}

async function getTabById(tabId: number): Promise<chrome.tabs.Tab> {
  return new Promise((resolve) => {
    chrome.tabs.get(tabId, resolve);
  });
}

async function openUrlInTab(
  url: string,
  options: { tabId?: number } = {},
): Promise<chrome.tabs.Tab | undefined> {
  let existingTab: chrome.tabs.Tab | undefined;
  if (!isNil(options.tabId)) {
    existingTab = await getTabById(options.tabId);
  }

  return new Promise((resolve) => {
    if (existingTab && existingTab.id) {
      // TODO close tab or update tab
      chrome.tabs.update(
        existingTab.id,
        {
          url,
          active: true, // focus this tab
        },
        resolve,
      );
      return;
    }

    chrome.tabs.create(
      {
        url,
      },
      resolve,
    );
  });
}

async function openStandaloneWindow(routeInfo: IOpenUrlRouteInfo) {
  const url = buildExtRouteUrl('ui-standalone-window.html', routeInfo);
  let left = 0;
  let top = 0;
  // debugger
  try {
    /* eslint-disable */
    const lastFocused = await browser.windows.getLastFocused();
    // Position window in top right corner of lastFocused window.
    if (lastFocused && lastFocused.top && lastFocused.left && lastFocused.width) {
      top = lastFocused.top;
      left = lastFocused.left + (lastFocused.width - UI_HTML_DEFAULT_MIN_WIDTH);
    }
    /* eslint-enable */
  } catch (_) {
    // The following properties are more than likely 0, due to being
    // opened from the background chrome process for the extension that
    // has no physical dimensions
    const { screenX, screenY, outerWidth } = window;
    top = Math.max(screenY, 0);
    left = Math.max(screenX + (outerWidth - UI_HTML_DEFAULT_MIN_WIDTH), 0);
  }
  return chrome.windows.create({
    focused: true,
    type: 'popup',
    // init size same to ext ui-popup.html
    height: UI_HTML_DEFAULT_MIN_HEIGHT + 50, // height including title bar, so should add 50px more
    width: UI_HTML_DEFAULT_MIN_WIDTH,
    // check useAutoRedirectToRoute()
    url,
    top,
    left,
  });
}

/**
 * ext get html function
 */
export const EXT_HTML_FILES = {
  background: 'background.html',
  uiPopup: 'ui-popup.html',
  uiExpandTab: 'ui-expand-tab.html',
  uiStandAloneWindow: 'ui-standalone-window.html',
};

export function getExtensionIndexHtml() {
  if (platformEnv.isExtensionBackgroundHtml) {
    return EXT_HTML_FILES.background;
  }
  if (platformEnv.isExtensionUiPopup) {
    return EXT_HTML_FILES.uiPopup;
  }
  if (platformEnv.isExtensionUiExpandTab) {
    return EXT_HTML_FILES.uiExpandTab;
  }
  if (platformEnv.isExtensionUiStandaloneWindow) {
    return EXT_HTML_FILES.uiStandAloneWindow;
  }
  return EXT_HTML_FILES.uiExpandTab;
}

export default {
  openUrl,
  openUrlInTab,
  openStandaloneWindow,
};
