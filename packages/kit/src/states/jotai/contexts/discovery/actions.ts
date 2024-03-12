import { useRef } from 'react';

import { isEqual } from 'lodash';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETabRoutes } from '@onekeyhq/kit/src/routes/Tab/type';
import { ContextJotaiActionsBase } from '@onekeyhq/kit/src/states/jotai/utils/ContextJotaiActionsBase';
import { openUrl } from '@onekeyhq/kit/src/utils/openUrl';
import type {
  IBrowserBookmark,
  IBrowserHistory,
  IGotoSiteFnParams,
  IMatchDAppItemType,
  IOnWebviewNavigationFnParams,
  IWebTab,
} from '@onekeyhq/kit/src/views/Discovery/types';
import {
  browserTypeHandler,
  crossWebviewLoadUrl,
  injectToPauseWebsocket,
  injectToResumeWebsocket,
  validateUrl,
  webviewRefs,
} from '@onekeyhq/kit/src/views/Discovery/utils/explorerUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';

import {
  activeTabIdAtom,
  contextAtomMethod,
  displayHomePageAtom,
  phishingLruCacheAtom,
  webTabsAtom,
  webTabsMapAtom,
} from './atoms';

import type { IElectronWebView } from '@onekeyfe/cross-inpage-provider-types';
import type { WebView } from 'react-native-webview';

export const homeResettingFlags: Record<string, number> = {};

function buildWebTabData(tabs: IWebTab[]) {
  const map: Record<string, IWebTab> = {};
  const keys: string[] = [];
  tabs.sort((a, b) => {
    if (a.timestamp && b.timestamp) {
      return a.timestamp - b.timestamp;
    }
    return 0;
  });
  tabs.forEach((tab) => {
    keys.push(tab.id);
    map[tab.id] = tab;
  });
  return {
    data: tabs,
    keys,
    map,
  };
}

const BLANK_PAGE_URL = 'about:blank';
export const homeTab: IWebTab = {
  id: 'home',
  // current url in webview
  url: BLANK_PAGE_URL,
  title: 'OneKey',
  canGoBack: false,
  loading: false,
  favicon: '',
};

class ContextJotaiActionsDiscovery extends ContextJotaiActionsBase {
  /**
   * Browser web tab action
   */
  setDisplayHomePage = contextAtomMethod((_, set, payload: boolean) => {
    set(displayHomePageAtom(), payload);
  });

  buildWebTabs = contextAtomMethod(
    (
      get,
      set,
      payload: { data: IWebTab[]; options?: { forceUpdate?: boolean } },
    ) => {
      const webTabs = get(webTabsAtom());
      const { data, options } = payload;
      let newTabs = data;
      if (!Array.isArray(data)) {
        throw new Error('setWebTabsWriteAtom: payload must be an array');
      }
      if (!newTabs || !newTabs.length) {
        newTabs = [];
      }
      const result = buildWebTabData(newTabs);
      // Should update tabs
      if (!isEqual(result.keys, webTabs.keys) || options?.forceUpdate) {
        set(webTabsAtom(), { keys: result.keys, tabs: result.data });
      }

      set(webTabsMapAtom(), () => result.map);
      void backgroundApiProxy.simpleDb.browserTabs.setRawData({
        tabs: result.data,
      });
    },
  );

  refreshTabs = contextAtomMethod((get, set) => {
    const { tabs } = get(webTabsAtom());
    const newTabs = [...tabs];
    this.buildWebTabs.call(set, {
      data: newTabs,
      options: { forceUpdate: true },
    });
  });

  setCurrentWebTab = contextAtomMethod((get, set, tabId: string | null) => {
    const currentTabId = get(activeTabIdAtom());
    if (currentTabId !== tabId) {
      this.pauseDappInteraction.call(set, currentTabId);

      // set isActive to true
      const { tabs } = get(webTabsAtom());
      const targetIndex = tabs.findIndex((t) => t.id === tabId);
      tabs.forEach((t) => {
        t.isActive = false;
      });
      this.buildWebTabs.call(set, { data: [...tabs] });
      if (targetIndex !== -1) {
        tabs[targetIndex].isActive = true;
        set(activeTabIdAtom(), tabId);
        this.resumeDappInteraction.call(set, tabId);
      } else {
        set(activeTabIdAtom(), '');
      }
    }
    const displayHomePage = get(displayHomePageAtom());
    if (tabId && displayHomePage) {
      this.setDisplayHomePage.call(set, false);
    }
    if (!tabId && !displayHomePage) {
      this.setDisplayHomePage.call(set, true);
    }
  });

  addWebTab = contextAtomMethod((get, set, payload: Partial<IWebTab>) => {
    const startTime = performance.now();
    const { tabs } = get(webTabsAtom());
    if (!payload.id || payload.id === homeTab.id) {
      payload.id = generateUUID();
    }
    payload.timestamp = Date.now();
    this.buildWebTabs.call(set, { data: [...tabs, payload as IWebTab] });
    this.setCurrentWebTab.call(set, payload.id ?? '');
    const endTime = performance.now();
    console.log(`addBlankWebTab took ${endTime - startTime} milliseconds.`);
  });

  addBlankWebTab = contextAtomMethod((_, set) => {
    this.addWebTab.call(set, { ...homeTab, isActive: true });
  });

  setWebTabData = contextAtomMethod((get, set, payload: Partial<IWebTab>) => {
    const { tabs: previousTabs } = get(webTabsAtom());
    const tabs = previousTabs;
    const tabIndex = tabs.findIndex((t) => t.id === payload.id);
    if (tabIndex > -1) {
      const tabToModify = tabs[tabIndex];
      Object.keys(payload).forEach((k) => {
        const key = k as keyof IWebTab;
        const value = payload[key];
        if (value !== undefined && value !== tabToModify[key]) {
          if (key === 'title') {
            if (!value) {
              return;
            }
          }
          // @ts-expect-error
          tabToModify[key] = value;
          if (key === 'url') {
            tabToModify.timestamp = Date.now();
            if (value === 'about:blank' && payload.id) {
              homeResettingFlags[payload.id] = tabToModify.timestamp;
            }
          }
        }
      });
      tabs[tabIndex] = tabToModify;
      this.buildWebTabs.call(set, { data: tabs });
    }
  });

  closeWebTab = contextAtomMethod((get, set, tabId: string) => {
    delete webviewRefs[tabId];
    const { tabs } = get(webTabsAtom());
    const activeTabId = get(activeTabIdAtom());
    const targetIndex = tabs.findIndex((t) => t.id === tabId);
    if (targetIndex !== -1) {
      if (tabs[targetIndex].id === activeTabId) {
        const prev = tabs[targetIndex - 1];
        if (prev) {
          prev.isActive = true;
          this.setCurrentWebTab.call(set, prev.id);
        }
      }
      tabs.splice(targetIndex, 1);
    }
    this.buildWebTabs.call(set, { data: [...tabs] });
  });

  closeAllWebTabs = contextAtomMethod((get, set) => {
    const { tabs } = get(webTabsAtom());
    const activeTabId = get(activeTabIdAtom());
    const pinnedTabs = tabs.filter((tab) => tab.isPinned); // close all tabs exclude pinned tab
    // should update active tab, if active tab is not in pinnedTabs
    if (pinnedTabs.every((tab) => tab.id !== activeTabId)) {
      if (pinnedTabs.length) {
        pinnedTabs[pinnedTabs.length - 1].isActive = true;
        this.setCurrentWebTab.call(set, pinnedTabs[pinnedTabs.length - 1].id);
      }
    }
    for (const id of Object.getOwnPropertyNames(webviewRefs)) {
      if (!pinnedTabs.find((tab) => tab.id === id)) {
        delete webviewRefs[id];
      }
    }
    this.buildWebTabs.call(set, { data: pinnedTabs });
  });

  setPinnedTab = contextAtomMethod(
    (_, set, payload: { id: string; pinned: boolean }) => {
      this.setWebTabData.call(set, {
        id: payload.id,
        isPinned: payload.pinned,
        timestamp: Date.now(),
      });
      this.refreshTabs.call(set);
    },
  );

  /**
   * Bookmark actions
   */
  syncBookmark = contextAtomMethod(
    (get, set, payload: { url: string; isBookmark: boolean }) => {
      const tabMap = get(webTabsMapAtom());
      if (!tabMap) return;
      Object.entries(tabMap).forEach(([, value]) => {
        if (value.url === payload.url) {
          this.setWebTabData.call(set, {
            id: value.id,
            isBookmark: payload.isBookmark,
          });
        }
      });
    },
  );

  getBookmarkData = contextAtomMethod(async () => {
    const bookmarks =
      (await backgroundApiProxy.simpleDb.browserBookmarks.getRawData())?.data ??
      [];
    return bookmarks;
  });

  buildBookmarkData = contextAtomMethod(
    (_, set, payload: IBrowserBookmark[]) => {
      if (!Array.isArray(payload)) {
        throw new Error('buildBookmarkData: payload must be an array');
      }
      // set(browserBookmarkAtom(), payload);
      void backgroundApiProxy.simpleDb.browserBookmarks.setRawData({
        data: payload,
      });
    },
  );

  addBrowserBookmark = contextAtomMethod(
    async (_, set, payload: IBrowserBookmark) => {
      if (!payload.url || payload.url === homeTab.url) {
        return;
      }

      const bookmarks = await this.getBookmarkData.call(set);

      // Filter out any bookmarks that have the same URL as the new one
      const filteredBookmarks = bookmarks.filter(
        (bookmark) => bookmark.url !== payload.url,
      );
      const newBookmark = { url: payload.url, title: payload.title };
      const updatedBookmarks = [...filteredBookmarks, newBookmark];
      this.buildBookmarkData.call(set, updatedBookmarks);
      this.syncBookmark.call(set, { url: payload.url, isBookmark: true });
    },
  );

  removeBrowserBookmark = contextAtomMethod(async (_, set, payload: string) => {
    const bookmarks = await this.getBookmarkData.call(set);
    const updatedBookmarks = bookmarks.filter(
      (bookmark) => bookmark.url !== payload,
    );
    this.buildBookmarkData.call(set, updatedBookmarks);
    this.syncBookmark.call(set, { url: payload, isBookmark: false });
  });

  modifyBrowserBookmark = contextAtomMethod(
    async (_, set, payload: IBrowserBookmark) => {
      if (!payload.url || payload.url === homeTab.url) {
        return;
      }
      const bookmark = await this.getBookmarkData.call(set);
      const updatedBookmark = bookmark.map((item) =>
        item.url === payload.url ? { ...item, ...payload } : item,
      );
      this.buildBookmarkData.call(set, updatedBookmark);
    },
  );

  /**
   * History actions
   */
  getHistoryData = contextAtomMethod(async () => {
    const histories =
      (await backgroundApiProxy.simpleDb.browserHistory.getRawData())?.data ??
      [];
    return histories;
  });

  buildHistoryData = contextAtomMethod((_, set, payload: IBrowserHistory[]) => {
    if (!Array.isArray(payload)) {
      throw new Error('buildHistoryData: payload must be an array');
    }
    void backgroundApiProxy.simpleDb.browserHistory.setRawData({
      data: payload,
    });
  });

  addBrowserHistory = contextAtomMethod(
    async (_, set, payload: Omit<IBrowserHistory, 'id' | 'createdAt'>) => {
      if (!payload.url || payload.url === homeTab.url) {
        return;
      }
      const history = await this.getHistoryData.call(set);

      const updatedHistory = history.filter((item) => item.url !== payload.url);

      const newHistoryEntry = {
        id: generateUUID(),
        url: payload.url,
        title: payload.title,
        createdAt: Date.now(),
      };

      this.buildHistoryData.call(set, [newHistoryEntry, ...updatedHistory]);
    },
  );

  removeBrowserHistory = contextAtomMethod(async (_, set, payload: string) => {
    const history = await this.getHistoryData.call(set);

    const updatedHistory = history.filter((item) => item.id !== payload);

    this.buildHistoryData.call(set, updatedHistory);
  });

  removeAllBrowserHistory = contextAtomMethod(async (_, set) => {
    this.buildHistoryData.call(set, []);
  });

  /**
   * Browser Logic
   */
  getWebTabById = contextAtomMethod((get, _, tabId: string) => {
    const tabMaps = get(webTabsMapAtom());
    return tabMaps?.[tabId || ''];
  });

  gotoSite = contextAtomMethod(
    async (
      _,
      set,
      {
        id,
        url,
        title,
        favicon,
        isNewWindow,
        isInPlace,
        userTriggered,
      }: IGotoSiteFnParams,
    ) => {
      const tab = this.getWebTabById.call(set, id ?? '');
      if (url) {
        const validatedUrl = validateUrl(url);
        if (!validatedUrl) {
          return;
        }

        if (userTriggered) {
          void this.addBrowserHistory.call(set, {
            url: validatedUrl,
            title: title ?? '',
          });
        }

        if (browserTypeHandler === 'StandardBrowser') {
          return openUrl(validatedUrl);
        }

        const tabId = tab?.id;
        const maybeDeepLink =
          !validatedUrl.startsWith('http') && validatedUrl !== 'about:blank';

        const isNewTab =
          typeof isNewWindow === 'boolean'
            ? isNewWindow
            : (isNewWindow || !tabId || tabId === 'home' || maybeDeepLink) &&
              browserTypeHandler === 'MultiTabBrowser';

        const bookmarks = await this.getBookmarkData.call(set);
        const isBookmark = bookmarks?.some((item) =>
          item.url.includes(validatedUrl),
        );
        if (isNewTab) {
          this.addWebTab.call(set, {
            title,
            url: validatedUrl,
            favicon,
            isBookmark,
          });
        } else {
          this.setWebTabData.call(set, {
            id: tabId,
            url: validatedUrl,
            title,
            favicon,
            isBookmark,
          });
        }

        if (!isNewTab && !isInPlace) {
          crossWebviewLoadUrl({
            url: validatedUrl,
            tabId,
          });
        }

        // close deep link tab after 1s
        if (maybeDeepLink) {
          if (browserTypeHandler === 'MultiTabBrowser' && tabId) {
            setTimeout(() => {
              this.closeWebTab.call(set, tabId);
            }, 1000);
          }
        }
        return true;
      }
      return false;
    },
  );

  openMatchDApp = contextAtomMethod(
    async (
      _,
      set,
      { dApp, webSite, isNewWindow, tabId }: IMatchDAppItemType,
    ) => {
      if (webSite) {
        return this.gotoSite.call(set, {
          id: tabId,
          url: webSite.url,
          title: webSite.title,
          favicon:
            await backgroundApiProxy.serviceDiscovery.buildWebsiteIconUrl(
              webSite.url,
            ),
          isNewWindow,
          userTriggered: true,
        });
      }
      if (dApp) {
        return this.gotoSite.call(set, {
          id: tabId,
          url: dApp.url,
          title: dApp.name,
          dAppId: dApp.dappId,
          favicon: dApp.logo || dApp.originLogo,
          userTriggered: true,
          isNewWindow,
        });
      }
    },
  );

  handleOpenWebSite = contextAtomMethod(
    (
      _,
      set,
      {
        useCurrentWindow,
        tabId,
        navigation,
        webSite,
        dApp,
        shouldPopNavigation = true,
      }: {
        navigation: ReturnType<typeof useAppNavigation>;
        useCurrentWindow?: boolean;
        tabId?: string;
        webSite?: IMatchDAppItemType['webSite'];
        dApp?: IMatchDAppItemType['dApp'];
        shouldPopNavigation?: boolean;
      },
    ) => {
      const isNewWindow = !useCurrentWindow;
      this.setDisplayHomePage.call(set, false);
      void this.openMatchDApp.call(set, {
        webSite,
        dApp,
        isNewWindow,
        tabId,
      });
      if (platformEnv.isDesktop) {
        navigation.switchTab(ETabRoutes.MultiTabBrowser);
      } else if (shouldPopNavigation) {
        navigation.pop();
      }
    },
  );

  onNavigation = contextAtomMethod(
    (
      get,
      set,
      {
        url,
        isNewWindow,
        isInPlace,
        title,
        favicon,
        canGoBack,
        canGoForward,
        loading,
        id,
        handlePhishingUrl,
      }: IOnWebviewNavigationFnParams,
    ) => {
      const now = Date.now();
      const tab = this.getWebTabById.call(set, id ?? '');
      if (!tab) {
        return;
      }
      const isValidNewUrl = typeof url === 'string' && url !== tab.url;

      if (url) {
        const cache = get(phishingLruCacheAtom());
        const { action } = uriUtils.parseDappRedirect(
          url,
          Array.from(cache.keys()),
        );
        if (action === uriUtils.EDAppOpenActionEnum.DENY) {
          handlePhishingUrl?.(url);
          return;
        }
      }

      if (isValidNewUrl) {
        if (tab.timestamp && now - tab.timestamp < 500) {
          // ignore url change if it's too fast to avoid back & forth loop
          return;
        }
        if (
          homeResettingFlags[tab.id] &&
          url !== homeTab.url &&
          now - homeResettingFlags[tab.id] < 1000
        ) {
          return;
        }

        void this.gotoSite.call(set, {
          url,
          title,
          favicon,
          isNewWindow,
          isInPlace,
          id: tab.id,
        });
      }

      this.setWebTabData.call(set, {
        id: tab.id,
        title,
        favicon,
        canGoBack,
        canGoForward,
        loading,
      });
    },
  );

  addUrlToPhishingCache = contextAtomMethod(
    (get, set, payload: { url: string }) => {
      try {
        const { origin } = new URL(payload.url);
        const cache = get(phishingLruCacheAtom());
        cache.set(origin, true);
        set(phishingLruCacheAtom(), cache);
        window.desktopApi?.setAllowedPhishingUrls(Array.from(cache.keys()));
      } catch {
        // ignore
      }
    },
  );

  updateDappActivityInteraction = contextAtomMethod(
    (get, _, payload: { id?: string | null; type: 'pause' | 'resume' }) => {
      let tabId: string | undefined | null = payload.id;
      if (!tabId) {
        tabId = get(activeTabIdAtom());
      }
      const ref = tabId ? webviewRefs[tabId] : null;
      if (ref) {
        const shouldPause = payload.type === 'pause';
        const injectCode = shouldPause
          ? injectToPauseWebsocket
          : injectToResumeWebsocket;
        // update jsBridge interaction
        if (ref.jsBridge) {
          ref.jsBridge.globalOnMessageEnabled = !shouldPause;
        }
        // update wallet connect websocket
        if (platformEnv.isNative) {
          try {
            (ref.innerRef as WebView)?.injectJavaScript(injectCode);
          } catch (error) {
            // ipad mini orientation changed cause injectJavaScript ERROR, which crash app
            console.error(
              `${
                shouldPause ? 'pauseDappInteraction' : 'resumeDappInteraction'
              } webview.injectJavaScript() ERROR >>>>> `,
              error,
            );
          }
        }
        if (platformEnv.isDesktop) {
          const deskTopRef = ref.innerRef as IElectronWebView;
          if (deskTopRef) {
            try {
              deskTopRef.executeJavaScript(injectCode);
            } catch (e) {
              // if not dom ready, no need to pause websocket
            }
          }
        }
      }
    },
  );

  pauseDappInteraction = contextAtomMethod((_, set, payload: string | null) => {
    this.updateDappActivityInteraction.call(set, {
      id: payload,
      type: 'pause',
    });
  });

  resumeDappInteraction = contextAtomMethod(
    (_, set, payload: string | null) => {
      this.updateDappActivityInteraction.call(set, {
        id: payload,
        type: 'resume',
      });
    },
  );
}

const createActions = memoFn(() => {
  console.log('new ContextJotaiActionsDiscovery()', Date.now());
  return new ContextJotaiActionsDiscovery();
});

export function useBrowserTabActions() {
  const actions = createActions();
  const addWebTab = actions.addWebTab.use();
  const addBlankWebTab = actions.addBlankWebTab.use();
  const buildWebTabs = actions.buildWebTabs.use();
  const refreshTabs = actions.refreshTabs.use();
  const setWebTabData = actions.setWebTabData.use();
  const closeWebTab = actions.closeWebTab.use();
  const closeAllWebTabs = actions.closeAllWebTabs.use();
  const setCurrentWebTab = actions.setCurrentWebTab.use();
  const setPinnedTab = actions.setPinnedTab.use();
  const setDisplayHomePage = actions.setDisplayHomePage.use();

  return useRef({
    addWebTab,
    addBlankWebTab,
    buildWebTabs,
    refreshTabs,
    setWebTabData,
    closeWebTab,
    closeAllWebTabs,
    setCurrentWebTab,
    setPinnedTab,
    setDisplayHomePage,
  });
}

export function useBrowserBookmarkAction() {
  const actions = createActions();
  const buildBookmarkData = actions.buildBookmarkData.use();
  const getBookmarkData = actions.getBookmarkData.use();
  const addBrowserBookmark = actions.addBrowserBookmark.use();
  const removeBrowserBookmark = actions.removeBrowserBookmark.use();
  const modifyBrowserBookmark = actions.modifyBrowserBookmark.use();

  return useRef({
    buildBookmarkData,
    getBookmarkData,
    addBrowserBookmark,
    removeBrowserBookmark,
    modifyBrowserBookmark,
  });
}

export function useBrowserHistoryAction() {
  const actions = createActions();
  const buildHistoryData = actions.buildHistoryData.use();
  const getHistoryData = actions.getHistoryData.use();
  const addBrowserHistory = actions.addBrowserHistory.use();
  const removeBrowserHistory = actions.removeBrowserHistory.use();
  const removeAllBrowserHistory = actions.removeAllBrowserHistory.use();

  return useRef({
    buildHistoryData,
    getHistoryData,
    addBrowserHistory,
    removeBrowserHistory,
    removeAllBrowserHistory,
  });
}

export function useBrowserAction() {
  const actions = createActions();
  const gotoSite = actions.gotoSite.use();
  const openMatchDApp = actions.openMatchDApp.use();
  const handleOpenWebSite = actions.handleOpenWebSite.use();
  const onNavigation = actions.onNavigation.use();
  const addUrlToPhishingCache = actions.addUrlToPhishingCache.use();
  const pauseDappInteraction = actions.pauseDappInteraction.use();
  const resumeDappInteraction = actions.resumeDappInteraction.use();

  return useRef({
    gotoSite,
    openMatchDApp,
    handleOpenWebSite,
    onNavigation,
    addUrlToPhishingCache,
    pauseDappInteraction,
    resumeDappInteraction,
  });
}
