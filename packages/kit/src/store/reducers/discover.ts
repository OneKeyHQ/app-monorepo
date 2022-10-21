import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import {
  DAppItemType,
  DiscoverHistory,
  HistoryItemData,
  WebSiteHistory,
} from '../../views/Discover/type';

type InitialState = {
  dappHistory?: Record<string, HistoryItemData>;
  dappItems?: DAppItemType[] | null;
  tags?: { name: string; _id: string }[];
  categories?: { name: string; _id: string }[];
  dappFavorites?: string[];
  categoryItems?: Record<string, DAppItemType[]>;
  tagItems?: Record<string, DAppItemType[]>;
  history: Record<string, DiscoverHistory>;

  firstRemindDAPP: boolean;
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
    setTags(state, action: PayloadAction<{ name: string; _id: string }[]>) {
      state.tags = action.payload;
    },
    setCategories(
      state,
      action: PayloadAction<{ name: string; _id: string }[]>,
    ) {
      state.categories = action.payload;
    },
    setDappItems(state, action: PayloadAction<DAppItemType[]>) {
      state.dappItems = action.payload;
    },
    setCategoryItems(
      state,
      action: PayloadAction<Record<string, DAppItemType[]>>,
    ) {
      state.categoryItems = action.payload;
    },
    setTagItems(state, action: PayloadAction<Record<string, DAppItemType[]>>) {
      state.tagItems = action.payload;
    },
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
    addFavorite(state, action: PayloadAction<string>) {
      if (!state.dappFavorites) {
        state.dappFavorites = [];
      }
      if (state.dappFavorites.includes(action.payload)) {
        return;
      }
      state.dappFavorites.push(action.payload);
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
  setCategories,
  setCategoryItems,
  setTags,
  setTagItems,
  setDappItems,
} = discoverSlice.actions;

export default discoverSlice.reducer;
