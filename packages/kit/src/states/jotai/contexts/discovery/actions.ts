import { useRef } from 'react';

import { debounce, isEqual } from 'lodash';

import { Toast, rootNavigationRef, switchTabAsync } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { handleDeepLinkUrl } from '@onekeyhq/kit/src/routes/config/deeplink';
import { parseReferralLandingUrl } from '@onekeyhq/kit/src/routes/config/deeplink/referralLandingLink';
import { ContextJotaiActionsBase } from '@onekeyhq/kit/src/states/jotai/utils/ContextJotaiActionsBase';
import { MaximumNumberOfTabs } from '@onekeyhq/kit/src/views/Discovery/config/Discovery.constants';
import type {
  ESiteMode,
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
  webviewRefs,
} from '@onekeyhq/kit/src/views/Discovery/utils/explorerUtils';
import {
  devSettingsPersistAtom,
  settingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { jotaiDefaultStore } from '@onekeyhq/kit-bg/src/states/jotai/utils/jotaiDefaultStore';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ERootRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import { onVisibilityStateChange } from '@onekeyhq/shared/src/utils/appVisibility';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import {
  clearPendingDiscoveryUrl,
  openUrlInApp,
} from '@onekeyhq/shared/src/utils/openUrlUtils';
import sortUtils from '@onekeyhq/shared/src/utils/sortUtils';
import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';
import { EValidateUrlEnum } from '@onekeyhq/shared/types/dappConnection';

import {
  activeTabIdAtom,
  browserDataReadyAtom,
  contextAtomMethod,
  disabledAddedNewTabAtom,
  displayHomePageAtom,
  lastClosedTabAtom,
  phishingLruCacheAtom,
  webTabsAtom,
  webTabsMapAtom,
} from './atoms';

import type { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';
import type { IElectronWebView } from '@onekeyfe/cross-inpage-provider-types';
import type { WebView } from 'react-native-webview';

function loggerForEmptyData(tabs: IWebTab[], fnName: string) {
  if (!tabs || tabs.length === 0) {
    defaultLogger.discovery.browser.setTabsDataFunctionName(fnName);
    defaultLogger.discovery.browser.tabsData(tabs);
  }
}

// Gap between timestamps when placing a tab above the current unpinned min.
// Must exceed the drag-reorder midpoint precision: `onDragEnd` inserts
// `Math.round((a + b) / 2)`, so a 1ms gap collapses to the neighbor and
// produces duplicate timestamps that destabilize sort order.
const TOP_POSITION_TIMESTAMP_GAP = 1000;

// Lowest timestamp among unpinned tabs; callers subtract a gap to sort above them.
function getMinUnpinnedTimestamp(tabs: IWebTab[], excludeId?: string) {
  return tabs
    .filter(
      (t) => !t.isPinned && t.timestamp && (!excludeId || t.id !== excludeId),
    )
    .reduce(
      (min, t) => Math.min(min, t.timestamp ?? min),
      Number.MAX_SAFE_INTEGER,
    );
}

function isNewTabPositionTop() {
  return (
    platformEnv.isDesktop &&
    jotaiDefaultStore.get(settingsPersistAtom.atom()).newBrowserTabPosition ===
      'top'
  );
}

// How a tab-array persist should reach SimpleDb.
// - Debounced: coalesce high-frequency churn (navigate/reorder/title updates).
// - Immediate: discrete, high-intent actions (closing a tab / all tabs) must
//   land synchronously so a hard quit right after cannot restore a stale,
//   larger snapshot.
export enum EBrowserTabPersistMode {
  Immediate = 'immediate',
  Debounced = 'debounced',
}

// Raw, non-debounced persist of the full tab array to SimpleDb. Returns the
// underlying setRawData promise so callers (and the debounced wrapper's
// `.flush()`) can await durability before the JS runtime is suspended.
function persistTabsToSimpleDb(tabs: IWebTab[]) {
  return backgroundApiProxy.simpleDb.browserTabs.setRawData({ tabs });
}

// Coalesce rapid persistence of browser-tab state. Each user action (open,
// close, reorder, navigate) used to flush the full tab array to SimpleDb
// immediately; in iPad logs we saw ~65 writes in 4 minutes, every one
// crossing the bg bridge and re-serializing.
//
// leading:true persists the first change in a burst immediately so an
// open/close/reorder followed by a hard quit (desktop window close, iOS
// background freeze that lands inside the 500ms window) still lands at
// least the user-visible action. trailing:true covers the last frame of
// a continuing burst; maxWait caps lag during sustained activity. Worst-
// case loss is now a mid-burst intermediate frame, not the final action.
//
// The body returns the setRawData promise so `.flush()` returns it too,
// letting the visibility handler await the final write.
const persistTabsToSimpleDbDebounced = debounce(
  (tabs: IWebTab[]) => persistTabsToSimpleDb(tabs),
  500,
  { leading: true, trailing: true, maxWait: 2000 },
);

// Flush the pending debounced persist before the JS runtime can be suspended
// or the window closes. Routed through `onVisibilityStateChange` so we cover
// all four platforms uniformly (mobile AppState, desktop Electron focus,
// web document.hidden + window blur) — a bare RN `AppState.addEventListener`
// is silent dead code on desktop and incomplete on web.
//
// iOS in particular may freeze the bridge in <500ms after backgrounding,
// which would otherwise drop the last user action (open/close/reorder tab).
// `await` the flushed write so the persist has a chance to commit on the
// background thread before suspension.
onVisibilityStateChange(async (visible) => {
  if (!visible) {
    await persistTabsToSimpleDbDebounced.flush();
  }
});

function isLocalhostUrlAllowedInDAppBrowser() {
  const devSettings = jotaiDefaultStore.get(devSettingsPersistAtom.atom());
  const result = Boolean(
    devSettings?.enabled &&
    devSettings.settings?.allowLocalhostUrlInDAppBrowser,
  );
  return result;
}

export const homeResettingFlags: Record<string, number> = {};

// Tracks last navigation time per tab id for the 500ms redirect-loop
// debounce in `onNavigation`. Decoupled from `tab.timestamp` because the
// latter also drives sidebar sort order (`top` mode freezes it on creation).
export const lastNavigationFlags: Record<string, number> = {};

let discoveryHomeBookmarksPrefetchGeneration = 0;
let isDiscoveryHomeBookmarksPrefetchListenerReady = false;

function invalidateDiscoveryHomeBookmarksPrefetch() {
  discoveryHomeBookmarksPrefetchGeneration += 1;
}

function ensureDiscoveryHomeBookmarksPrefetchListener() {
  if (isDiscoveryHomeBookmarksPrefetchListenerReady) {
    return;
  }
  appEventBus.on(
    EAppEventBusNames.RefreshBookmarkList,
    invalidateDiscoveryHomeBookmarksPrefetch,
  );
  appEventBus.on(
    EAppEventBusNames.InvalidateDiscoveryHomeBookmarksPrefetch,
    invalidateDiscoveryHomeBookmarksPrefetch,
  );
  isDiscoveryHomeBookmarksPrefetchListenerReady = true;
}

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

export const homeTab: IWebTab = {
  id: 'home',
  // current url in webview
  url: 'about:blank',
  title: 'OneKey',
  canGoBack: false,
  loading: false,
  favicon: '',
};

type IAddWebTabPayload = Partial<IWebTab> & {
  shouldActivate?: boolean;
};

function prefetchDiscoveryHomePageData() {
  ensureDiscoveryHomeBookmarksPrefetchListener();
  discoveryHomeBookmarksPrefetchGeneration += 1;
  const bookmarksPrefetchGeneration = discoveryHomeBookmarksPrefetchGeneration;
  const { serviceDiscovery } = backgroundApiProxy;
  void Promise.allSettled([
    serviceDiscovery.fetchDiscoveryHomePageData().then((data) => {
      if (data) {
        swrCacheUtils.set(swrKeys.discoveryHomePageData(), data);
      }
    }),
    serviceDiscovery
      .getBookmarkData({
        generateIcon: true,
        sliceCount: 14,
      })
      .then((data) => {
        if (
          bookmarksPrefetchGeneration ===
          discoveryHomeBookmarksPrefetchGeneration
        ) {
          swrCacheUtils.set(swrKeys.discoveryHomeBookmarks(), data);
        }
      }),
  ]);
}

class ContextJotaiActionsDiscovery extends ContextJotaiActionsBase {
  closeTimeId: ReturnType<typeof setTimeout> | null = null;

  /**
   * Browser web tab action
   */
  setDisplayHomePage = contextAtomMethod((_, set, payload: boolean) => {
    set(displayHomePageAtom(), payload);
  });

  setBrowserDataReady = contextAtomMethod((_, set) => {
    set(browserDataReadyAtom(), true);
  });

  buildWebTabs = contextAtomMethod(
    (
      get,
      set,
      payload: {
        data: IWebTab[];
        options?: {
          forceUpdate?: boolean;
          isInitFromStorage?: boolean;
          // Defaults to Debounced to preserve existing caller behavior.
          persist?: EBrowserTabPersistMode;
        };
      },
    ) => {
      const { data, options } = payload;
      const isReady = get(browserDataReadyAtom());
      if (!isReady && !options?.isInitFromStorage) {
        return;
      }
      const webTabs = get(webTabsAtom());
      let newTabs = data;
      if (!Array.isArray(data)) {
        throw new OneKeyLocalError(
          'setWebTabsWriteAtom: payload must be an array',
        );
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
      loggerForEmptyData(result.data, 'buildWebTabs->saveToSimpleDB');
      if (options?.persist === EBrowserTabPersistMode.Immediate) {
        // Cancel any pending trailing debounced write so it cannot later
        // overwrite this authoritative snapshot, then persist immediately.
        persistTabsToSimpleDbDebounced.cancel();
        void persistTabsToSimpleDb(result.data);
      } else {
        // Debounced wrapper now returns the inner persist promise; the
        // trailing/leading writes remain fire-and-forget here.
        void persistTabsToSimpleDbDebounced(result.data);
      }
    },
  );

  setTabsByIds = contextAtomMethod(
    (
      get,
      set,
      {
        pinnedTabs,
        unpinnedTabs,
      }: {
        pinnedTabs: { id: string; timestamp?: number }[];
        unpinnedTabs: { id: string; timestamp?: number }[];
      },
    ) => {
      const tabMap = get(webTabsMapAtom());
      const tabs: IWebTab[] = [];
      const now = Date.now();
      for (const { id, timestamp } of pinnedTabs) {
        tabs.push({
          ...tabMap[id],
          timestamp: timestamp ?? now,
          isPinned: true,
        });
      }
      for (const { id, timestamp } of unpinnedTabs) {
        tabs.push({
          ...tabMap[id],
          timestamp: timestamp ?? now,
          isPinned: false,
        });
      }
      this.buildWebTabs.call(set, {
        data: tabs,
      });
    },
  );

  setTabs = contextAtomMethod((get, set, tabs?: IWebTab[]) => {
    const newTabs = tabs ?? get(webTabsAtom())?.tabs;
    loggerForEmptyData(newTabs, 'setTabs');
    this.buildWebTabs.call(set, {
      data: [...newTabs],
      options: { forceUpdate: true },
    });
  });

  setCurrentWebTab = contextAtomMethod((get, set, tabId: string | null) => {
    const currentTabId = get(activeTabIdAtom());
    const { tabs } = get(webTabsAtom());
    const targetTabId = tabId ?? '';
    const hasTargetTab = tabs.some((t) => t.id === targetTabId);
    const nextActiveTabId = hasTargetTab ? targetTabId : '';
    const shouldUpdateActiveState = tabs.some(
      (t) => Boolean(t.isActive) !== (t.id === nextActiveTabId),
    );

    if (currentTabId !== nextActiveTabId || shouldUpdateActiveState) {
      if (currentTabId !== nextActiveTabId) {
        this.pauseDappInteraction.call(set, currentTabId);
      }

      const nextTabs = tabs.map((t) => {
        const isActive = t.id === nextActiveTabId;
        return t.isActive === isActive ? t : { ...t, isActive };
      });

      loggerForEmptyData(nextTabs, 'setCurrentWebTab');
      this.buildWebTabs.call(set, {
        data: nextTabs,
        options: { forceUpdate: true },
      });
      set(activeTabIdAtom(), nextActiveTabId);

      if (currentTabId !== nextActiveTabId && nextActiveTabId) {
        this.resumeDappInteraction.call(set, nextActiveTabId);
      }
    }

    const displayHomePage = get(displayHomePageAtom());
    if (nextActiveTabId && displayHomePage) {
      this.setDisplayHomePage.call(set, false);
    }
    if (!nextActiveTabId && !displayHomePage) {
      this.setDisplayHomePage.call(set, true);
    }
  });

  addWebTab = contextAtomMethod((get, set, payload: IAddWebTabPayload) => {
    const { shouldActivate = true, ...tabPayload } = payload;
    const { tabs } = get(webTabsAtom());
    if (!tabPayload.id || tabPayload.id === homeTab.id) {
      tabPayload.id = generateUUID();
    }
    if (isNewTabPositionTop()) {
      const minTs = getMinUnpinnedTimestamp(tabs);
      tabPayload.timestamp =
        minTs < Number.MAX_SAFE_INTEGER
          ? minTs - TOP_POSITION_TIMESTAMP_GAP
          : Date.now();
    } else {
      tabPayload.timestamp = Date.now();
    }
    this.buildWebTabs.call(set, { data: [...tabs, tabPayload as IWebTab] });
    if (shouldActivate) {
      this.setCurrentWebTab.call(set, tabPayload.id ?? '');
    }
  });

  addBlankWebTab = contextAtomMethod((_, set) => {
    this.addWebTab.call(set, { ...homeTab, isActive: true, type: 'normal' });
  });

  addBrowserHomeTab = contextAtomMethod((get, set) => {
    const { tabs } = get(webTabsAtom());
    const activeTabId = get(activeTabIdAtom());
    const activeTab = tabs.find((t) => t.id === activeTabId);
    const shouldActivate = !(
      platformEnv.isDesktop && activeTab?.type === 'home'
    );
    const id = generateUUID();
    this.addWebTab.call(set, {
      id,
      url: '',
      // eslint-disable-next-line onekey/no-app-locale-main-thread
      title: appLocale.intl.formatMessage({
        id: ETranslations.browser_start_tab,
      }),
      canGoBack: false,
      loading: false,
      favicon: '',
      isActive: shouldActivate,
      type: 'home',
      shouldActivate,
    });
    if (!shouldActivate) {
      prefetchDiscoveryHomePageData();
    }
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
            // Navigation normally bumps timestamp to Date.now(), which
            // re-sorts the tab to the bottom. Skip when the user chose
            // 'top' so the tab stays where it was created. Record the
            // navigation time separately for the onNavigation debounce.
            if (!isNewTabPositionTop()) {
              tabToModify.timestamp = Date.now();
            }
            if (payload.id) {
              lastNavigationFlags[payload.id] = Date.now();
            }
            if (value === 'about:blank' && payload.id) {
              homeResettingFlags[payload.id] = Date.now();
            }
          }
        }
      });
      tabs[tabIndex] = tabToModify;
      loggerForEmptyData(tabs, 'setWebTabData');
      this.buildWebTabs.call(set, { data: tabs });
    }
  });

  openUrlInHomeTab = contextAtomMethod(
    (
      get,
      set,
      payload: {
        id: string;
        url: string;
        title?: string;
        favicon?: string;
        isBookmark?: boolean;
        siteMode?: ESiteMode;
      },
    ) => {
      const { tabs } = get(webTabsAtom());
      const tabIndex = tabs.findIndex((t) => t.id === payload.id);
      if (tabIndex === -1) {
        return;
      }

      const previousTab = tabs[tabIndex];
      const nextTab: IWebTab = {
        ...previousTab,
        url: payload.url,
        title: payload.title || previousTab.title,
        favicon: payload.favicon ?? previousTab.favicon,
        isBookmark: payload.isBookmark,
        siteMode: payload.siteMode,
        type: 'normal',
        timestamp: previousTab.timestamp ?? Date.now(),
      };

      lastNavigationFlags[payload.id] = Date.now();

      const nextTabs = [...tabs];
      nextTabs[tabIndex] = nextTab;
      this.buildWebTabs.call(set, {
        data: nextTabs,
        options: { forceUpdate: true },
      });
    },
  );

  buildClosedTabData = contextAtomMethod((get, set, payload: IWebTab[]) => {
    const isReady = get(browserDataReadyAtom());
    if (!isReady) {
      return;
    }
    const tabs = payload.length > 100 ? payload.slice(20) : payload;
    void backgroundApiProxy.simpleDb.browserClosedTabs.setRawData({
      tabs,
    });
    set(lastClosedTabAtom(), { tabs });
  });

  reOpenLastClosedTab = contextAtomMethod((get, set) => {
    const { tabs } = get(lastClosedTabAtom());
    if (tabs.length) {
      const tab = tabs.pop();
      if (tab) {
        this.addWebTab.call(set, tab);
        this.buildClosedTabData.call(set, tabs);
        return true;
      }
    }
    return false;
  });

  saveLastClosedTab = contextAtomMethod(
    (get, set, tab: IWebTab | IWebTab[]) => {
      const { tabs } = get(lastClosedTabAtom());
      tabs.push(...(Array.isArray(tab) ? tab : [tab]));
      this.buildClosedTabData.call(set, tabs);
    },
  );

  closeWebTab = contextAtomMethod(
    (
      get,
      set,
      payload: {
        tabId: string;
        entry: 'Menu' | 'ShortCut' | 'BlockView';
        isDesktop?: boolean;
        navigation?: ReturnType<typeof useAppNavigation>;
      },
    ) => {
      const { tabId, entry, navigation } = payload;
      delete webviewRefs[tabId];
      const { tabs } = get(webTabsAtom());
      const targetIndex = tabs.findIndex((t) => t.id === tabId);
      if (targetIndex !== -1) {
        const closedTab = tabs[targetIndex];
        const activeTabId = get(activeTabIdAtom());
        const isClosingCurrentTab =
          closedTab.isActive || activeTabId === closedTab.id;
        tabs.splice(targetIndex, 1);

        // Add to browser history when tab is closed
        if (closedTab.url && closedTab.url !== homeTab.url) {
          void this.addBrowserHistory.call(set, {
            url: closedTab.url,
            title: closedTab.title || closedTab.url,
            logo: closedTab.favicon,
          });
        }

        const activateAdjacentTab = () => {
          if (platformEnv.isNative) {
            if (isClosingCurrentTab || !activeTabId) {
              this.setCurrentWebTab.call(set, null);
              return;
            }
          }

          let newActiveTabIndex = targetIndex - 1;

          if (newActiveTabIndex < 0 && tabs.length > 0) {
            newActiveTabIndex = 0;
          }

          // if current active tab is not in tabs, set it to the first tab
          const hasCurrentActiveTab = tabs.find((t) => t.isActive);

          if (hasCurrentActiveTab) {
            return;
          }

          // get the new active tab
          const newActiveTab = tabs[newActiveTabIndex];

          if (newActiveTab) {
            newActiveTab.isActive = true;
            this.setCurrentWebTab.call(set, newActiveTab.id);
          } else if (platformEnv.isDesktop) {
            // if the new active tab is not in tabs, switch to Discovery (Desktop only)
            navigation?.switchTab(ETabRoutes.Discovery);
          }
        };

        // Refresh the list after closing WebView in Electron to improve list fluidity
        if (platformEnv.isNative) {
          activateAdjacentTab();
        } else {
          if (this.closeTimeId) {
            clearTimeout(this.closeTimeId);
          }

          this.closeTimeId = setTimeout(() => {
            activateAdjacentTab();
          }, 100);
        }

        setTimeout(() => {
          this.saveLastClosedTab.call(set, closedTab);
        }, 50);
      }
      loggerForEmptyData([...tabs], 'closeWebTab');
      // Closing a tab is a discrete, high-intent action. Persist the final
      // tab array immediately (and cancel any pending debounced write from
      // the adjacent-tab activation above) so a hard quit right after cannot
      // restore the stale, larger snapshot.
      this.buildWebTabs.call(set, {
        data: [...tabs],
        options: { persist: EBrowserTabPersistMode.Immediate },
      });
      defaultLogger.discovery.browser.closeTab({
        closeMethod: entry,
      });
    },
  );

  closeAllWebTabs = contextAtomMethod(
    async (
      get,
      set,
      payload?: { navigation?: ReturnType<typeof useAppNavigation> },
    ) => {
      const navigation = payload?.navigation;
      const { tabs } = get(webTabsAtom());
      const activeTabId = get(activeTabIdAtom());
      const pinnedTabs = tabs.filter((tab) => tab.isPinned); // close all tabs exclude pinned tab
      const tabsToClose = tabs.filter((tab) => !tab.isPinned);
      const nextPinnedTab = pinnedTabs[0];
      const shouldResetActiveTab = pinnedTabs.every(
        (tab) => tab.id !== activeTabId,
      );

      // Create a queue for closing tabs
      const closeQueue = tabsToClose.map((tab) => async () => {
        if (tab.url && tab.url !== homeTab.url) {
          await this.addBrowserHistory.call(set, {
            url: tab.url,
            title: tab.title || tab.url,
            logo: tab.favicon,
          });
        }
      });

      // Process queue sequentially
      for (const closeOperation of closeQueue) {
        await closeOperation();
      }

      // should update active tab, if active tab is not in pinnedTabs
      if (shouldResetActiveTab) {
        const nextActiveTabId = nextPinnedTab?.id ?? null;
        this.setCurrentWebTab.call(set, nextActiveTabId);

        if (!nextActiveTabId && platformEnv.isDesktop) {
          navigation?.switchTab(ETabRoutes.Discovery);
        }
      }

      for (const id of Object.getOwnPropertyNames(webviewRefs)) {
        if (!pinnedTabs.find((tab) => tab.id === id)) {
          delete webviewRefs[id];
        }
      }

      loggerForEmptyData(pinnedTabs, 'closeAllWebTabs');
      // Same rationale as closeWebTab: persist the final (pinned-only) array
      // immediately so closing all tabs cannot be lost to a pending debounce.
      this.buildWebTabs.call(set, {
        data: pinnedTabs,
        options: { persist: EBrowserTabPersistMode.Immediate },
      });

      setTimeout(() => {
        this.saveLastClosedTab.call(set, tabsToClose);
      }, 50);

      defaultLogger.discovery.browser.clearTabs({
        clearTabsAmount: tabsToClose.length,
      });
    },
  );

  setPinnedTab = contextAtomMethod(
    (get, set, payload: { id: string; pinned: boolean }) => {
      let timestamp = Date.now();
      // When unpinning, place the tab at the top of the unpinned list
      if (!payload.pinned) {
        const allTabs = get(webTabsAtom())?.tabs ?? [];
        const minTs = getMinUnpinnedTimestamp(allTabs, payload.id);
        if (minTs < Number.MAX_SAFE_INTEGER) {
          timestamp = minTs - TOP_POSITION_TIMESTAMP_GAP;
        }
      }
      this.setWebTabData.call(set, {
        id: payload.id,
        isPinned: payload.pinned,
        timestamp,
      });
      this.setTabs.call(set);

      // track pinned tab
      const currentTab = this.getWebTabById.call(set, payload.id);
      const newTabs = get(webTabsAtom())?.tabs;
      const pinnedTabsAmount = newTabs.filter((tab) => tab.isPinned).length;
      const trackParams = {
        dappName: currentTab.title ?? '',
        dappDomain: currentTab.url ?? '',
        pinnedTabsAmount,
      };
      if (payload.pinned) {
        defaultLogger.discovery.browser.pinTab(trackParams);
      } else {
        defaultLogger.discovery.browser.unpinTab(trackParams);
      }
    },
  );

  setSiteMode = contextAtomMethod(
    (get, set, payload: { id: string; siteMode: ESiteMode }) => {
      this.setWebTabData.call(set, {
        id: payload.id,
        siteMode: payload.siteMode,
      });
      this.setTabs.call(set);
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
    (
      get,
      set,
      payload: {
        data: IBrowserBookmark[];
        isRemove?: boolean; // remove payload.data
        options?: { isInitFromStorage?: boolean };
        skipSaveLocalSyncItem?: boolean;
        useServerDataTime?: boolean;
      },
    ) => {
      const {
        data,
        isRemove,
        options,
        skipSaveLocalSyncItem,
        useServerDataTime,
      } = payload;
      const isReady = get(browserDataReadyAtom());
      // web always ready
      const isBrowserDataReady =
        isReady || platformEnv.isWeb || platformEnv.isExtension;
      if (!isBrowserDataReady && !options?.isInitFromStorage) {
        return;
      }
      if (!Array.isArray(data)) {
        throw new OneKeyLocalError(
          'buildBookmarkData: payload must be an array',
        );
      }

      void backgroundApiProxy.serviceDiscovery.setBrowserBookmarks({
        bookmarks: data,
        isRemove,
        skipSaveLocalSyncItem,
        useServerDataTime,
      });
    },
  );

  addOrUpdateBrowserBookmark = contextAtomMethod(
    async (_, set, payload: IBrowserBookmark) => {
      if (!payload.url || payload.url === homeTab.url) {
        return;
      }
      const newBookmark: IBrowserBookmark = {
        url: payload.url,
        title: payload.title,
        logo: payload.logo ?? undefined,
        sortIndex: payload.sortIndex ?? undefined,
      };
      const updatedBookmarks = [newBookmark];
      this.buildBookmarkData.call(set, {
        data: updatedBookmarks,
        useServerDataTime: true,
      });
      this.syncBookmark.call(set, { url: payload.url, isBookmark: true });
      void backgroundApiProxy.serviceCloudBackup.requestAutoBackup();

      defaultLogger.discovery.browser.addBookmark({
        dappName: payload.title,
        dappDomain: payload.url,
      });
    },
  );

  removeBrowserBookmark = contextAtomMethod(async (_, set, url: string) => {
    const bookmarks = await this.getBookmarkData.call(set);
    const removedBookmark = bookmarks.find((bookmark) => bookmark.url === url);
    if (!removedBookmark) {
      return;
    }
    this.buildBookmarkData.call(set, {
      data: [removedBookmark],
      isRemove: true,
      useServerDataTime: true,
    });
    this.syncBookmark.call(set, { url, isBookmark: false });

    defaultLogger.discovery.browser.removeBookmark({
      dappName: removedBookmark?.title || '',
      dappDomain: url,
    });
  });

  modifyBrowserBookmark = contextAtomMethod(
    async (_, set, payload: IBrowserBookmark) => {
      if (!payload.url || payload.url === homeTab.url) {
        return;
      }
      await this.addOrUpdateBrowserBookmark.call(set, payload);
    },
  );

  sortBrowserBookmark = contextAtomMethod(
    async (
      _,
      set,
      payload: {
        target: IBrowserBookmark;
        prev: IBrowserBookmark | undefined;
        next: IBrowserBookmark | undefined;
      },
    ) => {
      const { target, prev, next } = payload;
      const newSortIndex = sortUtils.buildNewSortIndex({
        target,
        prev,
        next,
      });
      await this.modifyBrowserBookmark.call(set, {
        ...target,
        sortIndex: newSortIndex,
      });
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

  buildHistoryData = contextAtomMethod(
    (
      get,
      set,

      payload: {
        data: IBrowserHistory[];
        options?: { isInitFromStorage?: boolean };
      },
    ) => {
      const { data, options } = payload;
      const isReady = get(browserDataReadyAtom());
      if (!isReady && !options?.isInitFromStorage) {
        return;
      }
      if (!Array.isArray(data)) {
        throw new OneKeyLocalError(
          'buildHistoryData: payload must be an array',
        );
      }
      void backgroundApiProxy.simpleDb.browserHistory.setRawData({
        data,
      });
    },
  );

  addBrowserHistory = contextAtomMethod(
    async (_, set, payload: Omit<IBrowserHistory, 'id' | 'createdAt'>) => {
      if (!payload.url || payload.url === homeTab.url) {
        return;
      }
      const history = await this.getHistoryData.call(set);

      const updatedHistory = history.filter((item) => item.url !== payload.url);

      const newHistoryEntry: IBrowserHistory = {
        id: generateUUID(),
        url: payload.url,
        title: payload.title,
        createdAt: Date.now(),
        // Skip data: URIs to avoid inflating storage
        logo: payload.logo?.startsWith('data:') ? undefined : payload.logo,
      };

      this.buildHistoryData.call(set, {
        data: [newHistoryEntry, ...updatedHistory],
      });
    },
  );

  removeBrowserHistory = contextAtomMethod(async (_, set, payload: string) => {
    const history = await this.getHistoryData.call(set);

    const updatedHistory = history.filter((item) => item.id !== payload);

    this.buildHistoryData.call(set, { data: updatedHistory });
  });

  removeAllBrowserHistory = contextAtomMethod(async (_, set) => {
    this.buildHistoryData.call(set, { data: [] });
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
        siteMode,
        isNewWindow,
        isInPlace,
      }: IGotoSiteFnParams,
    ) => {
      if (url) {
        if (parseReferralLandingUrl(url)) {
          handleDeepLinkUrl({ url });
          return false;
        }

        const allowLocalhostUrl = isLocalhostUrlAllowedInDAppBrowser();
        const isLocalhost = uriUtils.isLocalhostUrl(url);
        const shouldBlockLocalhostUrl = !allowLocalhostUrl && isLocalhost;
        const validatedUrl = shouldBlockLocalhostUrl
          ? uriUtils.ensureHttpPrefix(url)
          : uriUtils.validateUrl(url, {
              allowLocalhostUrl,
            });
        if (!validatedUrl) {
          return;
        }

        if (browserTypeHandler === 'StandardBrowser') {
          return openUrlInApp(validatedUrl);
        }

        const tab = this.getWebTabById.call(set, id ?? '');
        const tabId = tab?.id;

        const thisTab = this.getWebTabById.call(set, tabId ?? '');
        let isNewTab =
          typeof isNewWindow === 'boolean'
            ? isNewWindow
            : (isNewWindow || !tabId || tabId === 'home') &&
              browserTypeHandler === 'MultiTabBrowser';

        const shouldOpenInHomeTab = thisTab?.type === 'home';
        if (shouldOpenInHomeTab) {
          isNewTab = false;
        }

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
            siteMode,
            type: 'normal',
          });
        } else if (shouldOpenInHomeTab && tabId) {
          this.openUrlInHomeTab.call(set, {
            id: tabId,
            url: validatedUrl,
            title,
            favicon,
            isBookmark,
            siteMode,
          });
          if (!isInPlace) {
            this.setCurrentWebTab.call(set, tabId);
          }
        } else {
          this.setWebTabData.call(set, {
            id: tabId,
            url: validatedUrl,
            title,
            favicon,
            isBookmark,
            type: 'normal',
          });
          if (!isInPlace) {
            this.setCurrentWebTab.call(set, tabId ?? '');
          }
        }

        if (!isNewTab && !isInPlace && !shouldBlockLocalhostUrl) {
          crossWebviewLoadUrl({
            url: validatedUrl,
            tabId,
          });
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
        });
      }
      if (dApp) {
        return this.gotoSite.call(set, {
          id: tabId,
          url: dApp.url,
          title: dApp.name,
          dAppId: dApp.dappId,
          favicon: dApp.logo || dApp.originLogo,
          isNewWindow,
        });
      }
    },
  );

  handleOpenWebSite = contextAtomMethod(
    (
      get,
      set,
      {
        useCurrentWindow,
        tabId,
        navigation: _navigation,
        webSite,
        dApp,
      }: {
        navigation?: ReturnType<typeof useAppNavigation>;
        useCurrentWindow?: boolean;
        tabId?: string;
        webSite?: IMatchDAppItemType['webSite'];
        dApp?: IMatchDAppItemType['dApp'];
      },
    ) => {
      const url = dApp?.url ?? webSite?.url;
      if (url && parseReferralLandingUrl(url)) {
        handleDeepLinkUrl({ url });
        return;
      }

      // Auto-detect if already on Discovery/MultiTabBrowser tab
      let needsSwitchTab = true;
      try {
        const rootState = rootNavigationRef.current?.getRootState();
        const currentIndex = rootState?.index || 0;
        const currentRoute = rootState?.routes?.[currentIndex];
        const currentTabName =
          currentRoute?.name === ERootRoutes.Main
            ? currentRoute.state?.routes?.[currentRoute.state?.index || 0]?.name
            : undefined;
        if (platformEnv.isDesktop) {
          // On desktop, Discovery tab renders Dashboard (not browser with webviews).
          // Only MultiTabBrowser has actual webview content, so always switch
          // unless already on MultiTabBrowser.
          needsSwitchTab = currentTabName !== ETabRoutes.MultiTabBrowser;
        } else {
          needsSwitchTab =
            currentTabName !== ETabRoutes.Discovery &&
            currentTabName !== ETabRoutes.MultiTabBrowser;
        }
      } catch (e) {
        // fallback to switch tab if navigation state is not available
        console.warn('Failed to detect current tab:', e);
      }

      const isNewWindow = !useCurrentWindow;

      const openDApp = async () => {
        if (!useCurrentWindow) {
          const disabledAddedNewTab = get(disabledAddedNewTabAtom());
          if (disabledAddedNewTab) {
            Toast.message({
              // eslint-disable-next-line onekey/no-app-locale-main-thread
              title: appLocale.intl.formatMessage(
                { id: ETranslations.explore_toast_tab_limit_reached },
                { number: MaximumNumberOfTabs },
              ),
            });
            return false;
          }
        }
        const opened = await this.openMatchDApp.call(set, {
          webSite,
          dApp,
          isNewWindow,
          tabId,
        });
        if (opened) {
          this.setDisplayHomePage.call(set, false);
        }
        return opened;
      };

      if (needsSwitchTab) {
        const targetTab = platformEnv.isDesktop
          ? ETabRoutes.MultiTabBrowser
          : ETabRoutes.Discovery;

        if (platformEnv.isDesktop) {
          // Desktop renders the previous active web tab immediately after
          // switching to MultiTabBrowser. Create and activate the destination
          // tab first, then reveal MultiTabBrowser to avoid a visible flash of
          // the old active tab.
          void (async () => {
            const opened = await openDApp();
            if (opened) {
              appEventBus.emit(
                EAppEventBusNames.ClearSavedBrowserActiveTab,
                undefined,
              );
              await switchTabAsync(targetTab);
            }
          })();
          return;
        }

        // Serialize: dismiss any overlay (e.g. UniversalSearchModal) first,
        // then switch tab, wait for settle, then open the DApp page.
        // The old code used navigate(Main, {pop:true}) which overlaps modal
        // dismiss + tab switch + Main re-attach in one UIKit tick, creating
        // orphan RNSScreenStack instances on iOS that accumulate across
        // repeated search→open cycles and eventually freeze the UI.
        void (async () => {
          await switchTabAsync(targetTab);
          if (platformEnv.isNative) {
            clearPendingDiscoveryUrl();
            appEventBus.emit(EAppEventBusNames.SwitchDiscoveryTabInNative, {
              tab: ETranslations.global_browser,
              openUrl: true,
              shouldConsumePendingUrl: false,
            });
          }
          await openDApp();
        })();
      } else {
        // Already on Discovery/MultiTabBrowser — still emit the event to
        // pop inner pages and set the selected browser sub-tab.
        if (platformEnv.isNative) {
          clearPendingDiscoveryUrl();
          appEventBus.emit(EAppEventBusNames.SwitchDiscoveryTabInNative, {
            tab: ETranslations.global_browser,
            openUrl: true,
            shouldConsumePendingUrl: false,
          });
        }
        void openDApp();
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
        if (parseReferralLandingUrl(url)) {
          handleDeepLinkUrl({ url });
          return;
        }

        const cache = get(phishingLruCacheAtom());
        const allowLocalhostUrl = isLocalhostUrlAllowedInDAppBrowser();
        const { action } = uriUtils.parseDappRedirect(
          url,
          Array.from(cache.keys()),
          {
            allowLocalhostUrl,
          },
        );
        if (action === uriUtils.EDAppOpenActionEnum.DENY) {
          defaultLogger.discovery.browser.logRejectUrl(url);
          handlePhishingUrl?.(url);
          return;
        }
        if (uriUtils.isValidDeepLink(url)) {
          handleDeepLinkUrl({ url });
          return;
        }
      }

      if (isValidNewUrl) {
        const lastNav = lastNavigationFlags[tab.id];
        if (lastNav && now - lastNav < 500) {
          return;
        }
        if (
          homeResettingFlags[tab.id] &&
          url !== homeTab.url &&
          now - homeResettingFlags[tab.id] < 1000
        ) {
          return;
        }

        // Only call gotoSite for real navigation, not SPA route changes
        // SPA route changes typically have loading: false and navigationType: "other"
        if (loading) {
          void this.gotoSite.call(set, {
            url,
            title,
            favicon,
            isNewWindow,
            isInPlace,
            id: tab.id,
          });
        }
      }

      this.setWebTabData.call(set, {
        displayUrl: url,
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
        void globalThis.desktopApiProxy?.webview.setAllowedPhishingUrls(
          Array.from(cache.keys()),
        );
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
          backgroundApiProxy.connectBridge(
            ref.jsBridge as unknown as JsBridgeBase,
          );
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
            } catch (_e) {
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

  validateWebviewSrc = contextAtomMethod(
    (get, _, payload: { url: string; isTopFrame?: boolean }) => {
      const { url, isTopFrame = true } = payload;
      if (!url) {
        return EValidateUrlEnum.InvalidUrl;
      }
      const cache = get(phishingLruCacheAtom());
      const allowLocalhostUrl = isLocalhostUrlAllowedInDAppBrowser();
      const { action } = uriUtils.parseDappRedirect(
        url,
        Array.from(cache.keys()),
        {
          isTopFrame,
          allowLocalhostUrl,
        },
      );
      if (action === uriUtils.EDAppOpenActionEnum.DENY) {
        defaultLogger.discovery.browser.logRejectUrl(url);
        return EValidateUrlEnum.NotSupportProtocol;
      }
      if (uriUtils.containsPunycode(url)) {
        defaultLogger.discovery.browser.logRejectUrl(url);
        return EValidateUrlEnum.InvalidPunycode;
      }
      if (parseReferralLandingUrl(url)) {
        return EValidateUrlEnum.ValidDeeplink;
      }
      if (uriUtils.isValidDeepLink(url)) {
        return EValidateUrlEnum.ValidDeeplink;
      }
      return EValidateUrlEnum.Valid;
    },
  );
}

const createActions = memoFn(() => {
  return new ContextJotaiActionsDiscovery();
});

export function useBrowserTabActions() {
  const actions = createActions();
  const addWebTab = actions.addWebTab.use();
  const addBlankWebTab = actions.addBlankWebTab.use();
  const addBrowserHomeTab = actions.addBrowserHomeTab.use();
  const buildWebTabs = actions.buildWebTabs.use();
  const setTabs = actions.setTabs.use();
  const setTabsByIds = actions.setTabsByIds.use();
  const setWebTabData = actions.setWebTabData.use();
  const getWebTabById = actions.getWebTabById.use();
  const closeWebTab = actions.closeWebTab.use();
  const closeAllWebTabs = actions.closeAllWebTabs.use();
  const setCurrentWebTab = actions.setCurrentWebTab.use();
  const setPinnedTab = actions.setPinnedTab.use();
  const setDisplayHomePage = actions.setDisplayHomePage.use();
  const setBrowserDataReady = actions.setBrowserDataReady.use();
  const reOpenLastClosedTab = actions.reOpenLastClosedTab.use();
  const setSiteMode = actions.setSiteMode.use();
  return useRef({
    addWebTab,
    addBlankWebTab,
    addBrowserHomeTab,
    buildWebTabs,
    setTabs,
    setTabsByIds,
    setWebTabData,
    getWebTabById,
    closeWebTab,
    closeAllWebTabs,
    setCurrentWebTab,
    setPinnedTab,
    setDisplayHomePage,
    setBrowserDataReady,
    reOpenLastClosedTab,
    setSiteMode,
  });
}

export function useBrowserBookmarkAction() {
  const actions = createActions();
  const buildBookmarkData = actions.buildBookmarkData.use();
  const getBookmarkData = actions.getBookmarkData.use();
  const addOrUpdateBrowserBookmark = actions.addOrUpdateBrowserBookmark.use();
  const removeBrowserBookmark = actions.removeBrowserBookmark.use();
  const modifyBrowserBookmark = actions.modifyBrowserBookmark.use();
  const sortBrowserBookmark = actions.sortBrowserBookmark.use();

  return useRef({
    buildBookmarkData,
    getBookmarkData,
    addOrUpdateBrowserBookmark,
    removeBrowserBookmark,
    modifyBrowserBookmark,
    sortBrowserBookmark,
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
  const validateWebviewSrc = actions.validateWebviewSrc.use();

  return useRef({
    gotoSite,
    openMatchDApp,
    handleOpenWebSite,
    onNavigation,
    addUrlToPhishingCache,
    pauseDappInteraction,
    resumeDappInteraction,
    validateWebviewSrc,
  });
}
