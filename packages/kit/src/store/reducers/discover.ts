import { createSlice } from '@reduxjs/toolkit';

import type {
  BookmarkItem,
  CatagoryType,
  DAppItemType,
  DiscoverHistory,
  HistoryItemData,
  TagDappsType,
  UserBrowserHistory,
  WebSiteHistory,
} from '../../views/Discover/type';
import type { PayloadAction } from '@reduxjs/toolkit';

type InitialState = {
  dappHistory?: Record<string, HistoryItemData>;

  userBrowserHistories?: UserBrowserHistory[];
  bookmarks?: BookmarkItem[];

  favoritesMigrated?: boolean;

  // REMOVED
  dappFavorites?: string[];
  dappItems?: DAppItemType[] | null;
  listedCategories?: { name: string; _id: string }[];
  listedTags?: { name: string; _id: string }[];
  categoryDapps?: { label: string; id: string; items: DAppItemType[] }[];
  tagDapps?: { label: string; id: string; items: DAppItemType[] }[];
  // REMOVED

  home?: {
    categories: CatagoryType[];
    tagDapps: TagDappsType[];
  };

  history: Record<string, DiscoverHistory>;
  firstRemindDAPP: boolean;
  // enableIOSDappSearch?: boolean;
  // showFullLayout?: boolean;
  showBookmark?: boolean;

  networkPrices?: Record<string, string>;
};

const initialState: InitialState = {
  history: {},
  firstRemindDAPP: true,
  dappHistory: {},
};

function getUrlHostName(urlStr: string | undefined): string | undefined {
  if (!urlStr) {
    return undefined;
  }
  try {
    const url = new URL(urlStr);
    return url.hostname.toLowerCase();
  } catch (error) {
    return undefined;
  }
}
function diffWebSite(
  oldWebSite: WebSiteHistory | undefined,
  newWebSite: WebSiteHistory | undefined,
): WebSiteHistory {
  const {
    title: oldTitle,
    url: oldUrl,
    favicon: oldFavicon,
  } = oldWebSite || {};
  const { title, url, favicon } = newWebSite || {};

  const newUrl = url && url !== '' ? url : oldUrl;
  const newTitle = title && title !== '' ? title : oldTitle;
  const newFavicon = favicon && favicon !== '' ? favicon : oldFavicon;

  return { title: newTitle, url: newUrl, favicon: newFavicon };
}

/**
 * 校验域名
 */
function compareDomainNames(
  hostname: string,
  url: string | undefined,
): boolean {
  if (!url) {
    return false;
  }
  try {
    const urlObj = new URL(url);
    const urlHostName = urlObj.hostname.toLowerCase();
    return urlHostName === hostname;
  } catch (error) {
    return false;
  }
}

export const discoverSlice = createSlice({
  name: 'discover',
  initialState,
  reducers: {
    updateHistory(state, action: PayloadAction<string>) {
      const history = state.history[action.payload];
      if (history) {
        state.history[action.payload] = {
          'clicks': (history?.clicks ?? 1) + 1,
          'timestamp': new Date().getTime(),
        };
      } else {
        state.history[action.payload] = {
          'clicks': 1,
          'timestamp': new Date().getTime(),
        };
      }
    },
    addWebSiteHistory(
      state,
      action: PayloadAction<{
        keyUrl?: string;
        webSite: WebSiteHistory;
      }>,
    ) {
      let hostname = action.payload.keyUrl;
      if (!hostname) {
        hostname = getUrlHostName(action.payload.webSite.url);
      }
      if (!hostname) return;

      const history = state.history[hostname];
      if (history) {
        state.history[hostname] = {
          webSite: diffWebSite(history?.webSite, action?.payload?.webSite),
          clicks: (history?.clicks ?? 1) + 1,
          timestamp: new Date().getTime(),
        };
      } else {
        state.history[hostname] = {
          webSite: diffWebSite(undefined, action?.payload?.webSite),
          clicks: 1,
          timestamp: new Date().getTime(),
        };
      }
    },
    removeWebSiteHistory(state, action: PayloadAction<string>) {
      delete state.history[action.payload];
    },
    updateWebSiteHistory(
      state,
      action: PayloadAction<{
        keyUrl?: string | undefined;
        webSite: WebSiteHistory;
      }>,
    ) {
      let hostname = action.payload.keyUrl;
      if (!hostname) {
        hostname = getUrlHostName(action.payload.webSite.url);
      }
      if (!hostname) return;

      if (!compareDomainNames(hostname, action.payload.webSite.url)) return;

      const history = state.history[hostname];
      if (history && history.webSite) {
        state.history[hostname] = {
          ...history,
          webSite: diffWebSite(history?.webSite, action?.payload?.webSite),
        };
      }
    },
    updateFirstRemindDAPP(state, action: PayloadAction<boolean>) {
      state.firstRemindDAPP = action.payload;
    },
    // setDappItems(state, action: PayloadAction<DAppItemType[]>) {
    //   state.dappItems = action.payload;
    // },
    setDappHistory(state, action: PayloadAction<string>) {
      if (!state.dappHistory) {
        state.dappHistory = {};
      }
      const dappHistory = state.dappHistory[action.payload];
      if (dappHistory) {
        state.dappHistory[action.payload] = {
          'clicks': (dappHistory?.clicks ?? 1) + 1,
          'timestamp': new Date().getTime(),
        };
      } else {
        state.dappHistory[action.payload] = {
          'clicks': 1,
          'timestamp': new Date().getTime(),
        };
      }
    },
    removeDappHistory(state, action: PayloadAction<string>) {
      if (!state.dappHistory) {
        state.dappHistory = {};
      }
      delete state.dappHistory[action.payload];
    },
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
    cleanOldState(state) {
      state.dappItems = undefined;
      state.listedCategories = undefined;
      state.listedTags = undefined;
      state.categoryDapps = undefined;
      state.tagDapps = undefined;
    },
    setHomeData(
      state,
      action: PayloadAction<{
        categories: CatagoryType[];
        tagDapps: TagDappsType[];
      }>,
    ) {
      state.home = action.payload;
    },
    setUserBrowserHistory(state, action: PayloadAction<UserBrowserHistory>) {
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
  updateHistory,
  updateFirstRemindDAPP,
  addWebSiteHistory,
  updateWebSiteHistory,
  setDappHistory,
  removeDappHistory,
  // addFavorite,
  // removeFavorite,
  removeWebSiteHistory,
  // setDappItems,
  // setListedCategories,
  // setListedTags,
  // setCategoryDapps,
  // setTagDapps,
  clearHistory,
  // setEnableIOSDappSearch,
  setShowBookmark,
  cleanOldState,
  setHomeData,
  setUserBrowserHistory,
  removeUserBrowserHistory,
  addBookmark,
  removeBookmark,
  updateBookmark,
  resetBookmarks,
  setFavoritesMigrated,
  setNetworkPrice,
} = discoverSlice.actions;

export default discoverSlice.reducer;
