import { observable } from '@legendapp/state';
import { persistObservable } from '@legendapp/state/persist';
import { nanoid } from 'nanoid';

import { ToastManager } from '@onekeyhq/components';
import { formatMessage } from '@onekeyhq/components/src/Provider';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  MIN_OR_HIDE,
  showTabGridAnim,
} from '../../views/Discover/Explorer/explorerAnimation';
import {
  pauseDappInteraction,
  resumeDappInteraction,
} from '../../views/Discover/Explorer/explorerUtils';

// TODO move to bootstrap
import './observable.config';

import type { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';

export interface WebTab {
  id: string;
  url: string;
  // urlToGo?: string;
  title?: string;
  favicon?: string;
  thumbnail?: string;
  // isPinned: boolean;
  isCurrent: boolean;
  isBookmarked?: boolean;
  // isMuted: boolean;
  canGoBack?: boolean;
  canGoForward?: boolean;
  loading?: boolean;
  ref?: IWebViewWrapperRef;
  timestamp?: number;
}

export const homeTab: WebTab = {
  id: 'home',
  // current url in webview
  url: 'about:blank',
  // // url to load (from outside control)
  // urlToGo: 'about:blank',
  // TODO i18n
  title: 'OneKey',
  isCurrent: true,
  canGoBack: false,
  loading: false,
};

export const homeResettingFlags: Record<string, number> = {};

const hasTabLimits = platformEnv.isNative && !platformEnv.isNativeIOSPad;
const MAX_WEB_TABS = 100;
export const isTabLimitReached = (tabs: WebTab[]) =>
  hasTabLimits && tabs.length >= MAX_WEB_TABS;

export const webTabsObs = observable([homeTab]);
export const incomingUrlObs = observable('');
// eslint-disable-next-line @typescript-eslint/naming-convention
let _currentTabId = '';
export const getCurrentTabId = () => {
  if (!_currentTabId) {
    _currentTabId = webTabsObs.peek().find((t) => t.isCurrent)?.id || '';
  }
  return _currentTabId;
};

persistObservable(webTabsObs, {
  local: 'webTabs',
});

export const webTabsActions = {
  addWebTab: (payload: Partial<WebTab>) => {
    const tabs = webTabsObs.get();
    if (isTabLimitReached(tabs)) {
      ToastManager.show(
        {
          title: formatMessage(
            { id: 'msg__tab_has_reached_the_maximum_limit_of_str' },
            {
              0: MAX_WEB_TABS - 1,
            },
          ),
        },
        {
          type: 'error',
        },
      );
      return;
    }
    if (!payload.id || payload.id === homeTab.id) {
      payload.id = nanoid();
    }
    if (payload.isCurrent) {
      for (const tab of tabs) {
        tab.isCurrent = false;
      }
      _currentTabId = payload.id;
    }
    payload.timestamp = Date.now();
    tabs.push(payload as WebTab);
    webTabsObs.set(tabs);
  },
  setWebTabData: (payload: Partial<Omit<WebTab, 'isCurrent'>>) => {
    const tabs = webTabsObs.get();
    const tab = tabs.find((t) => t.id === payload.id);
    if (tab) {
      Object.keys(payload).forEach((key) => {
        // @ts-ignore
        const value = payload[key];
        // @ts-ignore
        if (value !== undefined && value !== tab[key]) {
          if (key === 'title' && !value) {
            return;
          }
          // @ts-ignore
          tab[key] = value;
          if (key === 'url') {
            tab.timestamp = Date.now();
            if (value === homeTab.url && payload.id) {
              homeResettingFlags[payload.id] = Date.now();
            }
            if (!payload.favicon) {
              try {
                tab.favicon = `${new URL(tab.url).origin}/favicon.ico`;
                // eslint-disable-next-line no-empty
              } catch {}
            }
          }
        }
      });
      if (tab.url === homeTab.url) {
        tab.title = homeTab.title;
      }
      webTabsObs.set(tabs);
    }
  },
  closeWebTab: (tabId: string) => {
    // delete webviewRefs[payload];
    const tabs = webTabsObs.get();
    let targetIndex = -1;
    tabs.some((t, index) => {
      if (t.id === tabId) {
        if (t.isCurrent) {
          const prev = tabs[index - 1];
          prev.isCurrent = true;
          _currentTabId = prev.id;
        }
        targetIndex = index;
        return true;
      }
      return false;
    });
    tabs.splice(targetIndex, 1);
    if (tabs.length === 1) {
      showTabGridAnim.value = MIN_OR_HIDE;
    }
    webTabsObs.set(tabs);
  },
  closeAllWebTabs: () => {
    // for (const id of Object.getOwnPropertyNames(webviewRefs)) {
    //   delete webviewRefs[id];
    // }
    webTabsObs.set([homeTab]);
    _currentTabId = homeTab.id;
    showTabGridAnim.value = MIN_OR_HIDE;
  },
  setCurrentWebTab: (tabId: string) => {
    const currentTabId = getCurrentTabId();
    if (currentTabId !== tabId) {
      pauseDappInteraction(currentTabId);

      const webTabs = webTabsObs.get();
      let previousTabUpdated = false;
      let nextTabUpdated = false;
      for (const tab of webTabs) {
        if (tab.isCurrent) {
          tab.isCurrent = false;
          previousTabUpdated = true;
        } else if (tab.id === tabId) {
          tab.isCurrent = true;
          nextTabUpdated = true;
        }
        if (previousTabUpdated && nextTabUpdated) {
          break;
        }
      }
      webTabsObs.set(webTabs);
      resumeDappInteraction(tabId);
      _currentTabId = tabId;
    }
  },
  setIncomingUrl: (url: string) => {
    incomingUrlObs.set(url);
  },
};
