import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import {
  DAppItemType,
  DiscoverHistory,
  HistoryItemData,
  WebSiteHistory,
} from '../../views/Discover/type';

type InitialState = {
  dappHistory?: Record<string, HistoryItemData>;
  dappFavorites?: string[];

  // REMOVED
  dappItems?: DAppItemType[] | null;
  listedCategories?: { name: string; _id: string }[];
  listedTags?: { name: string; _id: string }[];
  categoryDapps?: { label: string; id: string; items: DAppItemType[] }[];
  tagDapps?: { label: string; id: string; items: DAppItemType[] }[];
  // REMOVED

  home?: {
    categories: { name: string; _id: string }[];
    tagDapps: { label: string; id: string; items: DAppItemType[] }[];
  };

  history: Record<string, DiscoverHistory>;
  firstRemindDAPP: boolean;
  // enableIOSDappSearch?: boolean;
  showFullLayout?: boolean;
};

const initialState: InitialState = {
  history: {},
  firstRemindDAPP: true,
  dappHistory: {},
  dappFavorites: [],
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
    },
    addFavorite(state, action: PayloadAction<string>) {
      if (!state.dappFavorites) {
        state.dappFavorites = [];
      }
      if (state.dappFavorites.includes(action.payload)) {
        return;
      }
      state.dappFavorites = [action.payload].concat(state.dappFavorites);
    },
    removeFavorite(state, action: PayloadAction<string>) {
      if (!state.dappFavorites) {
        state.dappFavorites = [];
      }
      const i = state.dappFavorites.findIndex((o) => o === action.payload);
      if (i >= 0) {
        state.dappFavorites.splice(i, 1);
      }
    },
    // setListedCategories(
    //   state,
    //   action: PayloadAction<{ name: string; _id: string }[]>,
    // ) {
    //   state.listedCategories = action.payload;
    // },
    // setListedTags(
    //   state,
    //   action: PayloadAction<{ name: string; _id: string }[]>,
    // ) {
    //   state.listedTags = action.payload;
    // },
    // setCategoryDapps(
    //   state,
    //   action: PayloadAction<
    //     { label: string; id: string; items: DAppItemType[] }[]
    //   >,
    // ) {
    //   state.categoryDapps = action.payload;
    // },
    // setTagDapps(
    //   state,
    //   action: PayloadAction<
    //     { label: string; id: string; items: DAppItemType[] }[]
    //   >,
    // ) {
    //   state.tagDapps = action.payload;
    // },
    // setEnableIOSDappSearch(state, action: PayloadAction<boolean>) {
    //   state.enableIOSDappSearch = action.payload;
    // },
    setShowFullLayout(state, action: PayloadAction<boolean>) {
      state.showFullLayout = action.payload;
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
        categories: { name: string; _id: string }[];
        tagDapps: { label: string; id: string; items: DAppItemType[] }[];
      }>,
    ) {
      state.home = action.payload;
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
  addFavorite,
  removeFavorite,
  removeWebSiteHistory,
  // setDappItems,
  // setListedCategories,
  // setListedTags,
  // setCategoryDapps,
  // setTagDapps,
  clearHistory,
  // setEnableIOSDappSearch,
  setShowFullLayout,
  cleanOldState,
  setHomeData,
} = discoverSlice.actions;

export default discoverSlice.reducer;
