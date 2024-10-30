import { isNil } from 'lodash';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { sidePanelState } from '@onekeyhq/shared/src/utils/sidePanelUtils';

import { EAppEventBusNames, appEventBus } from '../eventBus/appEventBus';

import { buildModalRouteParams } from './routeUtils';

/**
 * ext get html function
 */
export const EXT_HTML_FILES = {
  background: 'background.html',
  uiPopup: 'ui-popup.html',
  uiExpandTab: 'ui-expand-tab.html',
  uiPassKey: 'ui-passkey.html',
  uiSidePanel: 'ui-side-panel.html',
  uiStandAloneWindow: 'ui-standalone-window.html',
};

// Chrome extension popups can have a maximum height of 600px and maximum width of 800px
export const UI_HTML_DEFAULT_MIN_WIDTH = 375;
export const UI_HTML_DEFAULT_MIN_HEIGHT = 600;

export type IOpenUrlRouteInfo = {
  routes?: string | string[];
  path?: string;
  params?: any;
  modalParams?: {
    screen: any;
    params: any;
  };
};

function buildExtRouteUrl(
  htmlFile: string,
  { routes, params = {}, path }: IOpenUrlRouteInfo,
) {
  /*
  http://localhost:3001/#/modal/DappConnectionModal/ConnectionModal?id=0&origin=https%3A%2F%2Fmetamask.github.io&scope=ethereum&data=%7B%22method%22%3A%22eth_requestAccounts%22%2C%22jsonrpc%22%3A%222.0%22%7D
   */
  const pathStr = routes
    ? `/${([] as string[]).concat(routes).join('/')}`
    : path || '/';

  const paramsStr = new URLSearchParams(params).toString();

  let hash = '';
  if (pathStr || paramsStr) {
    hash = `#${pathStr || ''}`;
    if (paramsStr) {
      hash = `${hash}?${paramsStr || ''}`;
    }
  }

  return chrome.runtime.getURL(`/${htmlFile}${hash}`);
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

const getWindowPosition = async () => {
  let left = 0;
  let top = 0;
  try {
    /* eslint-disable */
    const lastFocused = await browser.windows.getLastFocused();
    // Position window in top right corner of lastFocused window.
    if (
      lastFocused &&
      lastFocused.top &&
      lastFocused.left &&
      lastFocused.width
    ) {
      top = lastFocused.top;
      left = lastFocused.left + (lastFocused.width - UI_HTML_DEFAULT_MIN_WIDTH);
    }
    /* eslint-enable */
  } catch (_) {
    // The following properties are more than likely 0, due to being
    // opened from the background chrome process for the extension that
    // has no physical dimensions
    const { screenX, screenY, outerWidth } = globalThis;
    top = Math.max(screenY, 0);
    left = Math.max(screenX + (outerWidth - UI_HTML_DEFAULT_MIN_WIDTH), 0);
  }
  return {
    top,
    left,
  };
};

async function openStandaloneWindow(routeInfo: IOpenUrlRouteInfo) {
  const url = buildExtRouteUrl('ui-standalone-window.html', routeInfo);
  const { top, left } = await getWindowPosition();
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

export enum EPassKeyWindowType {
  unlock = 'unlock',
  create = 'create',
}
export enum EPassKeyWindowFrom {
  popup = 'popup',
  sidebar = 'sidebar',
}
async function openPassKeyWindow(type: EPassKeyWindowType) {
  const url = buildExtRouteUrl(EXT_HTML_FILES.uiPassKey, {
    params: {
      type,
      from: platformEnv.isExtensionUiPopup
        ? EPassKeyWindowFrom.popup
        : EPassKeyWindowFrom.sidebar,
    },
  });
  const { top, left } = await getWindowPosition();
  return chrome.windows.create({
    focused: true,
    type: 'popup',
    // init size same to ext ui-popup.html
    height: 1, // height including title bar, so should add 50px more
    width: 1,
    // check useAutoRedirectToRoute()
    url,
    top,
    left,
  });
}

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
  if (platformEnv.isExtensionUiSidePanel) {
    return EXT_HTML_FILES.uiSidePanel;
  }
  return EXT_HTML_FILES.uiExpandTab;
}

let expandTabId: number | undefined;
async function openExpandTab(
  routeInfo: IOpenUrlRouteInfo,
): Promise<chrome.tabs.Tab | undefined> {
  const url = buildExtRouteUrl(EXT_HTML_FILES.uiExpandTab, routeInfo);
  const tab = await openUrlInTab(url, { tabId: expandTabId });
  expandTabId = tab?.id;
  return tab;
}

async function resetSidePanelPath() {
  if (typeof chrome !== 'undefined' && chrome.sidePanel) {
    const url = buildExtRouteUrl(EXT_HTML_FILES.uiSidePanel, {});
    await chrome.sidePanel.setOptions({
      path: url,
      enabled: true,
    });
  }
}

async function openSidePanel(
  routeInfo: IOpenUrlRouteInfo,
): Promise<chrome.tabs.Tab | undefined> {
  if (typeof chrome !== 'undefined' && chrome.sidePanel) {
    if (platformEnv.isExtensionBackground) {
      if (sidePanelState.isOpen) {
        const modalParams =
          routeInfo?.modalParams ??
          buildModalRouteParams({
            screens: routeInfo.routes as string[],
            routeParams: routeInfo.params,
          });
        appEventBus.emit(EAppEventBusNames.SidePanel_BgToUI, {
          type: 'pushModal',
          payload: {
            modalParams,
          },
        });
      } else {
        throw new Error('The sidePanel cannot be opened in the bg thread.');
      }
      return;
    }
    const url = buildExtRouteUrl(EXT_HTML_FILES.uiSidePanel, routeInfo);
    const window = await chrome.windows.getCurrent({ populate: true });
    const windowId = window.id;
    if (windowId) {
      await chrome.sidePanel.open({ windowId });
      await chrome.sidePanel.setOptions({
        path: url,
        enabled: true,
      });
      return;
    }
  }
  return openExpandTab(routeInfo);
}

async function openExpandTabOrSidePanel(routeInfo: IOpenUrlRouteInfo) {
  if (sidePanelState.isOpen) {
    return openSidePanel(routeInfo);
  }
  return openExpandTab(routeInfo);
}

async function openPanelOnActionClick(enableSidePanel: boolean) {
  await chrome.sidePanel.setPanelBehavior({
    openPanelOnActionClick: enableSidePanel,
  });
}

function focusExistWindow({
  windowId,
}: {
  windowId: number | undefined | null;
}) {
  if (windowId) {
    void chrome.windows.update(windowId, { focused: true });
  }
}

async function openPermissionSettings() {
  // eslint-disable-next-line spellcheck/spell-checker
  // chrome://settings/content/siteDetails?site=chrome-extension://apmndckkdnmkjblccnclblclninghkfh
  // eslint-disable-next-line spellcheck/spell-checker
  // edge://settings/content/siteDetails?site=chrome-extension://apmndckkdnmkjblccnclblclninghkfh

  const extensionId: string = chrome.runtime.id;
  await chrome.tabs.create({
    url: `chrome://settings/content/siteDetails?site=chrome-extension%3A%2F%2F${extensionId}%2F`,
  });
}

export default {
  openUrlInTab,
  openPassKeyWindow,
  openExpandTabOrSidePanel,
  openStandaloneWindow,
  openExpandTab,
  openSidePanel,
  resetSidePanelPath,
  focusExistWindow,
  openPanelOnActionClick,
  openPermissionSettings,
};
