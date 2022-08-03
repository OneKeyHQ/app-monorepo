import { isNil } from 'lodash';

import {
  UI_HTML_DEFAULT_MIN_HEIGHT,
  UI_HTML_DEFAULT_MIN_WIDTH,
} from '../../../ext/src/ui/popupSizeFix';
import { IS_LAZY_NAVIGATE_SUB_ROUTER } from '../views/Send/sendConfirmConsts';

let expandTabId: number | undefined;
export type OpenUrlRouteInfo = {
  routes: string | string[];
  params?: any;
};

function buildExtRouteUrl(
  htmlFile: string,
  { routes, params = {} }: OpenUrlRouteInfo,
) {
  /*
  http://localhost:3001/#/modal/DappConnectionModal/ConnectionModal?id=0&origin=https%3A%2F%2Fmetamask.github.io&scope=ethereum&data=%7B%22method%22%3A%22eth_requestAccounts%22%2C%22jsonrpc%22%3A%222.0%22%7D
   */
  const pathStr = ([] as string[]).concat(routes).join('/');
  const paramsStr = new URLSearchParams(params).toString();
  let hash = '';
  if (pathStr || paramsStr) {
    hash = `#/${pathStr || ''}`;
    if (paramsStr) {
      hash = `${hash}?${paramsStr || ''}`;
    }
  }
  if (hash && IS_LAZY_NAVIGATE_SUB_ROUTER) {
    const navigateRouterHash = encodeURIComponent(hash);
    return chrome.runtime.getURL(
      `/${htmlFile}?navigateRouterHash=${navigateRouterHash}`,
    );
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

async function openExpandTab(
  routeInfo: OpenUrlRouteInfo,
): Promise<chrome.tabs.Tab | undefined> {
  const url = buildExtRouteUrl('ui-expand-tab.html', routeInfo);
  const tab = await openUrlInTab(url, { tabId: expandTabId });
  expandTabId = tab?.id;
  return tab;
}

function openStandaloneWindow(routeInfo: OpenUrlRouteInfo) {
  const url = buildExtRouteUrl('ui-standalone-window.html', routeInfo);
  return chrome.windows.create({
    focused: true,
    type: 'popup',
    // init size same to ext ui-popup.html
    height: UI_HTML_DEFAULT_MIN_HEIGHT + 50, // height including title bar, so should add 50px more
    width: UI_HTML_DEFAULT_MIN_WIDTH,
    // check useAutoRedirectToRoute()
    url,
  });
}

export default {
  openUrl,
  openUrlInTab,
  openExpandTab,
  openStandaloneWindow,
};
