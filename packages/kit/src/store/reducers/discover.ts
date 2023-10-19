import { createSlice } from '@reduxjs/toolkit';

import type {
  BookmarkItem,
  CategoryType,
  DAppItemType,
  DiscoverHistory,
  GroupDappsType,
  HistoryItemData,
  UserBrowserHistory,
} from '../../views/Discover/type';
import type { PayloadAction } from '@reduxjs/toolkit';

type InitialState = {
  // REMOVED
  dappHistory?: Record<string, HistoryItemData>;
  dappFavorites?: string[];
  dappItems?: DAppItemType[] | null;
  listedCategories?: { name: string; _id: string }[];
  listedTags?: { name: string; _id: string }[];
  categoryDapps?: { label: string; id: string; items: DAppItemType[] }[];
  tagDapps?: { label: string; id: string; items: DAppItemType[] }[];
  history: Record<string, DiscoverHistory>;
  firstRemindDAPP: boolean;
  home?: {
    categories: CategoryType[];
    tagDapps: GroupDappsType[];
  };
  // REMOVED

  userBrowserHistories?: UserBrowserHistory[];
  bookmarks?: BookmarkItem[];
  favoritesMigrated?: boolean;
  showBookmark?: boolean;
  enableIOSDappSearch?: boolean;
  networkPrices?: Record<string, string>;
};

const initialState: InitialState = {
  history: {},
  firstRemindDAPP: true,
  dappHistory: {},
};

export const discoverSlice = createSlice({
  name: 'discover',
  initialState,
  reducers: {
    clearHistory(state) {
      state.dappHistory = {};
      state.userBrowserHistories = [];
    },
    addBookmark(state, action: PayloadAction<BookmarkItem>) {
      if (!state.bookmarks) {
        state.bookmarks = [];
      }
      const urls = state.bookmarks.map((item) => item.url);
      if (urls.includes(action.payload.url)) {
        return;
      }
      state.bookmarks = [action.payload].concat(state.bookmarks);
    },
    updateBookmark(state, action: PayloadAction<BookmarkItem>) {
      if (!state.bookmarks) {
        state.bookmarks = [];
      }
      const bookmark = state.bookmarks.find(
        (item) => item.id === action.payload.id,
      );
      if (bookmark) {
        const { url, title, icon } = action.payload;
        if (url) {
          bookmark.url = url;
        }
        if (title) {
          bookmark.title = title;
        }
        if (icon) {
          bookmark.icon = icon;
        }
      }
    },
    resetBookmarks(state, action: PayloadAction<BookmarkItem[]>) {
      state.bookmarks = action.payload;
      // state.dappFavorites = [];
    },
    removeBookmark(state, action: PayloadAction<BookmarkItem>) {
      if (!state.bookmarks) {
        state.bookmarks = [];
      }
      const { bookmarks } = state;
      const index = bookmarks.findIndex(
        (item) => item.url === action.payload.url,
      );

      if (index >= 0) {
        bookmarks.splice(index, 1);
      }

      state.bookmarks = bookmarks;
    },
    setShowBookmark(state, action: PayloadAction<boolean>) {
      state.showBookmark = action.payload;
    },
    setEnableIOSDappSearch(state, action: PayloadAction<boolean>) {
      state.enableIOSDappSearch = action.payload;
    },
    cleanOldState(state) {
      state.dappItems = undefined;
      state.listedCategories = undefined;
      state.listedTags = undefined;
      state.categoryDapps = undefined;
      state.tagDapps = undefined;
      state.home = undefined;
    },
    addUserBrowserHistory(state, action: PayloadAction<UserBrowserHistory>) {
      if (!state.userBrowserHistories) {
        state.userBrowserHistories = [];
      }
      const index = state.userBrowserHistories.findIndex(
        (o) => o.url === action.payload.url,
      );
      if (index < 0) {
        state.userBrowserHistories.unshift(action.payload);
      } else {
        const current = state.userBrowserHistories[index];
        const data = { ...current, ...action.payload };
        state.userBrowserHistories.splice(index, 1);
        state.userBrowserHistories.unshift(data);
      }
    },
    updateUserBrowserHistory(state, action: PayloadAction<UserBrowserHistory>) {
      if (!state.userBrowserHistories) {
        state.userBrowserHistories = [];
      }
      const index = state.userBrowserHistories.findIndex(
        (o) => o.url === action.payload.url,
      );
      if (index >= 0) {
        const current = state.userBrowserHistories[index];
        const data = { ...current, ...action.payload };
        state.userBrowserHistories[index] = data;
      }
    },
    removeUserBrowserHistory(state, action: PayloadAction<{ url: string }>) {
      if (!state.userBrowserHistories) {
        return;
      }
      state.userBrowserHistories = state.userBrowserHistories.filter(
        (o) => o.url !== action.payload.url,
      );
    },
    setFavoritesMigrated(state) {
      state.favoritesMigrated = true;
    },
    setNetworkPrice(
      state,
      action: PayloadAction<{ networkId: string; price: string }>,
    ) {
      const { payload } = action;
      if (!state.networkPrices) {
        state.networkPrices = {};
      }
      state.networkPrices[payload.networkId] = payload.price;
    },
  },
});

export const {
  clearHistory,
  setShowBookmark,
  setEnableIOSDappSearch,
  cleanOldState,
  addUserBrowserHistory,
  updateUserBrowserHistory,
  removeUserBrowserHistory,
  addBookmark,
  removeBookmark,
  updateBookmark,
  resetBookmarks,
  setFavoritesMigrated,
  setNetworkPrice,
} = discoverSlice.actions;

export default discoverSlice.reducer;
