import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { webviewRefs } from '../../views/Discover/Explorer/explorerUtils';

export interface WebTab {
  id: string;
  url: string;
  title?: string;
  favicon?: string;
  // isPinned: boolean;
  isCurrent: boolean;
  // isBookmarked?: boolean;
  // isMuted: boolean;
  canGoBack?: boolean;
  canGoForward?: boolean;
  loading?: boolean;
  refReady?: boolean;
}

export interface WebTabsInitialState {
  tabs: WebTab[];
  currentTabId: string;
  // external url passing to explorer to open
  incomingUrl: string;
}

const homeTab: WebTab = {
  id: 'home',
  url: '',
  title: 'OneKey',
  isCurrent: true,
};
const initialState: WebTabsInitialState = {
  tabs: [homeTab],
  currentTabId: 'home',
  incomingUrl: '',
};

export const webtabsSlice = createSlice({
  name: 'webTabs',
  initialState,
  reducers: {
    addWebTab: (state, { payload }: PayloadAction<WebTab>) => {
      if (payload.isCurrent) {
        for (const tab of state.tabs) {
          tab.isCurrent = false;
        }
        state.currentTabId = payload.id;
      }
      state.tabs.push(payload);
    },
    setWebTabData: (
      state,
      { payload }: PayloadAction<Partial<Omit<WebTab, 'isCurrent'>>>,
    ) => {
      const tab = state.tabs.find((t) => t.id === payload.id);
      if (tab) {
        Object.keys(payload).forEach((key) => {
          if (key === 'title' && !payload.title) {
            delete payload.title;
            // @ts-ignore
          } else if (payload[key] === undefined) {
            // @ts-ignore
            delete payload[key];
          }
        });
        Object.assign(tab, payload);
      }
    },
    closeWebTab: (state, { payload }: PayloadAction<string>) => {
      delete webviewRefs[payload];
      state.tabs = state.tabs.filter((tab, index) => {
        if (tab.id === payload) {
          const prev = state.tabs[index - 1];
          prev.isCurrent = true;
          state.currentTabId = prev.id;
          return false;
        }
        return true;
      });
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
} = webtabsSlice.actions;
export default webtabsSlice.reducer;
