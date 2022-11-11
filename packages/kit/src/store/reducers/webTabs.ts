import { PayloadAction, createSlice, nanoid } from '@reduxjs/toolkit';

import { ToastManager } from '@onekeyhq/components';
import { formatMessage } from '@onekeyhq/components/src/Provider';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { webviewRefs } from '../../views/Discover/Explorer/explorerUtils';

export interface WebTab {
  id: string;
  url: string;
  // urlToGo?: string;
  title?: string;
  favicon?: string;
  // isPinned: boolean;
  isCurrent: boolean;
  isBookmarked?: boolean;
  // isMuted: boolean;
  canGoBack?: boolean;
  canGoForward?: boolean;
  loading?: boolean;
  refReady?: boolean;
  timestamp?: number;
  thumbnail?: string;
}

export interface WebTabsInitialState {
  tabs: WebTab[];
  currentTabId: string;
  // external url passing to explorer to open
  incomingUrl: string;
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
const initialState: WebTabsInitialState = {
  tabs: [homeTab],
  currentTabId: 'home',
  incomingUrl: '',
};

export const homeResettingFlags: Record<string, number> = {};

const hasTabLimits = platformEnv.isNative && !platformEnv.isNativeIOSPad;
const MAXTABS = 10;
export const webtabsSlice = createSlice({
  name: 'webTabs',
  initialState,
  reducers: {
    addWebTab: (state, { payload }: PayloadAction<Partial<WebTab>>) => {
      if (hasTabLimits && state.tabs.length === MAXTABS) {
        ToastManager.show(
          formatMessage(
            { id: 'msg__tab_has_reached_the_maximum_limit_of_str' },
            {
              0: MAXTABS,
            },
          ),
        );
        return;
      }
      if (!payload.id || payload.id === homeTab.id) {
        payload.id = nanoid();
      }
      if (payload.isCurrent) {
        for (const tab of state.tabs) {
          tab.isCurrent = false;
        }
        state.currentTabId = payload.id;
      }
      payload.timestamp = Date.now();
      state.tabs.push(payload as WebTab);
    },
    setWebTabData: (
      state,
      { payload }: PayloadAction<Partial<Omit<WebTab, 'isCurrent'>>>,
    ) => {
      const tab = state.tabs.find((t) => t.id === payload.id);
      if (tab) {
        Object.keys(payload).forEach((key) => {
          // @ts-ignore
          const value = payload[key];
          // @ts-ignore
          if (value !== undefined && value !== tab[key]) {
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
      }
    },
    closeWebTab: (state, { payload }: PayloadAction<string>) => {
      delete webviewRefs[payload];
      state.tabs = state.tabs.filter((tab, index) => {
        if (tab.id === payload) {
          if (tab.isCurrent) {
            const prev = state.tabs[index - 1];
            prev.isCurrent = true;
            state.currentTabId = prev.id;
          }
          return false;
        }
        return true;
      });
    },
    closeAllWebTabs: (state) => {
      for (const id of Object.getOwnPropertyNames(webviewRefs)) {
        delete webviewRefs[id];
      }
      state.tabs = [homeTab];
      state.currentTabId = homeTab.id;
    },
    setCurrentWebTab: (state, { payload }: PayloadAction<string>) => {
      if (state.currentTabId !== payload) {
        for (const tab of state.tabs) {
          tab.isCurrent = tab.id === payload;
        }
        state.currentTabId = payload;
      }
    },
    setIncomingUrl: (state, { payload }: PayloadAction<string>) => {
      state.incomingUrl = payload;
    },
  },
});

export const {
  addWebTab,
  setWebTabData,
  closeWebTab,
  setCurrentWebTab,
  setIncomingUrl,
  closeAllWebTabs,
} = webtabsSlice.actions;
export default webtabsSlice.reducer;
