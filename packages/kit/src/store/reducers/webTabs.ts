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

export const tokensSlice = createSlice({
  name: 'webTabs',
  initialState,
  reducers: {
    addWebTab: (state, action: PayloadAction<WebTab>) => {
      if (action.payload.isCurrent) {
        for (const tab of state.tabs) {
          tab.isCurrent = false;
        }
        state.currentTabId = action.payload.id;
      }
      state.tabs.push(action.payload);
    },
    setWebTabData: (
      state,
      action: PayloadAction<Partial<Omit<WebTab, 'isCurrent'>>>,
    ) => {
      const tab = state.tabs.find((t) => t.id === action.payload.id);
      if (tab) {
        Object.assign(tab, action.payload);
      }
    },
    closeWebTab: (state, action: PayloadAction<string>) => {
      delete webviewRefs[action.payload];
      state.tabs = state.tabs.filter((tab, index) => {
        if (tab.id === action.payload) {
          const prev = state.tabs[index - 1];
          prev.isCurrent = true;
          state.currentTabId = prev.id;
          return false;
        }
        return true;
      });
    },
    setCurrentWebTab: (state, action: PayloadAction<string>) => {
      if (state.currentTabId !== action.payload) {
        for (const tab of state.tabs) {
          tab.isCurrent = tab.id === action.payload;
        }
        state.currentTabId = action.payload;
      }
    },
    setIncomingUrl: (state, action: PayloadAction<string>) => {
      state.incomingUrl = action.payload;
    },
  },
});

export const {
  addWebTab,
  setWebTabData,
  closeWebTab,
  setCurrentWebTab,
  setIncomingUrl,
} = tokensSlice.actions;
export default tokensSlice.reducer;
