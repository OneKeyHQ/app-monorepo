import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { RankingsPayload, SyncRequestPayload } from '../../views/Discover/type';

export type WebSiteHistory = {
  title?: string;
  url?: string;
  favicon?: string;
};
export type DiscoverHistory = {
  webSite?: WebSiteHistory; // 手动输入的普通网站
  clicks: number;
  timestamp: number;
};

type InitialState = {
  history: Record<string, DiscoverHistory>;
  syncData: SyncRequestPayload;
  firstRemindDAPP: boolean;
  rankData: RankingsPayload;
};

const initialState: InitialState = {
  history: {},
  syncData: { timestamp: 0, banners: [], increment: {} },
  firstRemindDAPP: true,
  rankData: { tags: [], special: { daily: [], new: [], weekly: [] } },
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
        keyUrl: string | undefined;
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
    updateSyncData(state, action: PayloadAction<InitialState['syncData']>) {
      state.syncData = action.payload;
    },
    updateFirstRemindDAPP(state, action: PayloadAction<boolean>) {
      state.firstRemindDAPP = action.payload;
    },
    updateRankData(state, action: PayloadAction<InitialState['rankData']>) {
      state.rankData = action.payload;
    },
  },
});

export const {
  updateHistory,
  updateSyncData,
  updateFirstRemindDAPP,
  updateRankData,
  addWebSiteHistory,
  updateWebSiteHistory,
} = discoverSlice.actions;

export default discoverSlice.reducer;
