import { observable } from '@legendapp/state';
import { persistObservable } from '@legendapp/state/persist';
import { nanoid } from 'nanoid';

import { ToastManager } from '@onekeyhq/components';
import { formatMessage } from '@onekeyhq/components/src/Provider';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  pauseDappInteraction,
  resumeDappInteraction,
  webviewRefs,
} from '../../views/Discover/Explorer/explorerUtils';

// TODO move to bootstrap
import './observable.config';

import { ToastManagerType } from '@onekeyhq/components/src/ToastManager';

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
  refReady?: boolean;
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

const hasTabLimits = platformEnv.isNative;
const MAX_WEB_TABS = 100;
export const isTabLimitReached = (tabs: (WebTab | undefined)[]) =>
  hasTabLimits && tabs.length >= MAX_WEB_TABS;

export const webTabsObs = observable([{ ...homeTab }]);
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
    const tabs = [...webTabsObs.get()];
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
        { type: ToastManagerType.error },
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
  addBlankWebTab: () => {
    webTabsActions.addWebTab({ ...homeTab });
  },
  setWebTabData: (payload: Partial<Omit<WebTab, 'isCurrent'>>) => {
    const tabs = [...webTabsObs.get()];
    let tabIndex = -1;
    const tab = {
      ...tabs.find((t, i) => {
        if (t.id === payload.id) {
          tabIndex = i;
          return true;
        }
        return false;
      }),
    } as WebTab;
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
              homeResettingFlags[payload.id] = tab.timestamp;
            }
            if (!payload.favicon) {
              try {
                tab.favicon = `${new URL(tab.url ?? '').origin}/favicon.ico`;
                // eslint-disable-next-line no-empty
              } catch {}
            }
          }
        }
      });
      if (tab.url === homeTab.url) {
        tab.title = homeTab.title;
      }
      tabs[tabIndex] = tab;
      webTabsObs.set(tabs);
    }
  },
  closeWebTab: (tabId: string) => {
    delete webviewRefs[tabId];
    const tabs = [...webTabsObs.get()];
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
      const { showTabGridAnim } =
        require('../../views/Discover/Explorer/explorerAnimation') as typeof import('../../views/Discover/Explorer/explorerAnimation');
      showTabGridAnim.value = 0;
    }
    webTabsObs.set(tabs);
  },
  closeAllWebTabs: () => {
    for (const id of Object.getOwnPropertyNames(webviewRefs)) {
      delete webviewRefs[id];
    }
    webTabsObs.set([{ ...homeTab }]);
    _currentTabId = homeTab.id;

    const { showTabGridAnim } =
      require('../../views/Discover/Explorer/explorerAnimation') as typeof import('../../views/Discover/Explorer/explorerAnimation');
    showTabGridAnim.value = 0;
  },
  setCurrentWebTab: (tabId: string) => {
    const currentTabId = getCurrentTabId();
    if (currentTabId !== tabId) {
      pauseDappInteraction(currentTabId);

      const tabs = [...webTabsObs.get()];
      let previousTabUpdated = false;
      let nextTabUpdated = false;

      // eslint-disable-next-line no-plusplus
      for (let i = 0; i < tabs.length; i++) {
        const tab = tabs[i];
        if (tab.isCurrent) {
          tabs[i] = {
            ...tab,
            isCurrent: false,
          };
          previousTabUpdated = true;
        } else if (tab.id === tabId) {
          tabs[i] = {
            ...tab,
            isCurrent: true,
          };
          nextTabUpdated = true;
        }
        if (previousTabUpdated && nextTabUpdated) {
          break;
        }
      }
      webTabsObs.set(tabs);
      resumeDappInteraction(tabId);
      _currentTabId = tabId;
    }
  },
  setIncomingUrl: (url: string) => {
    incomingUrlObs.set(url);
  },
};
