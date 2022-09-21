import { PayloadAction, createSlice } from '@reduxjs/toolkit';

export interface WebTab {
  id: string;
  url: string;
  title: string;
  favicon?: string;
  // isPinned: boolean;
  isHome?: boolean;
  isCurrent: boolean;
  // isBookmarked?: boolean;
  // isMuted: boolean;
}

export interface WebTabsInitialState {
  tabs: WebTab[];
  currentTabId: string;
  // pinnedTabs: WebTab[];
  // mutedTabs: WebTab[];
  // closedTabs: WebTab[];
}

const homeTab: WebTab = {
  id: 'home',
  url: '',
  title: 'OneKey',
  isHome: true,
  isCurrent: true,
};
const initialState: WebTabsInitialState = {
  tabs: [homeTab],
  currentTabId: '',
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
    closeWebTab: (state, action: PayloadAction<string>) => {
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
  },
});

export const { addWebTab, closeWebTab, setCurrentWebTab } = tokensSlice.actions;
export default tokensSlice.reducer;
