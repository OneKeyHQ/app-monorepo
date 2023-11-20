import {
  atom,
  createJotaiContext,
} from '@onekeyhq/kit/src/states/jotai/utils/createJotaiContext';
import simpleDb from '@onekeyhq/kit-bg/src/dbs/simple/simpleDb';

import { homeTab, syncBookmark } from './contextWebTabs';

import type { IBrowserBookmark } from '../types';

export const {
  withProvider: withProviderBrowserBookmark,
  useContextAtom: useAtomBrowserBookmark,
  store: browserBookmarkStore,
} = createJotaiContext({
  isSingletonStore: true,
});

export const browserBookmarkAtom = atom<IBrowserBookmark[]>([]);

export const setBookmarkDataAtom = atom(
  null,
  (get, set, payload: IBrowserBookmark[]) => {
    if (!Array.isArray(payload)) {
      return;
    }
    set(browserBookmarkAtom, payload);
    void simpleDb.browserBookmarks.setRawData({
      data: payload,
    });
  },
);

export const addBrowserBookmarkAtom = atom(
  null,
  (get, set, payload: IBrowserBookmark) => {
    if (!payload.url || payload.url === homeTab.url) {
      return;
    }
    const bookmark = get(browserBookmarkAtom);
    const index = bookmark.findIndex((item) => item.url === payload.url);
    if (index !== -1) {
      bookmark.splice(index, 1);
    }
    bookmark.push({ url: payload.url, title: payload.title });
    set(setBookmarkDataAtom, bookmark);
    console.log('===>set browserBookmarkAtom: ', bookmark);
    syncBookmark(payload.url, true);
  },
);

export const removeBrowserBookmarkAtom = atom(
  null,
  (get, set, payload: string) => {
    const bookmark = get(browserBookmarkAtom);
    const index = bookmark.findIndex((item) => item.url === payload);
    if (index !== -1) {
      bookmark.splice(index, 1);
    }
    set(setBookmarkDataAtom, bookmark);
    syncBookmark(payload, false);
  },
);

export const getBrowserBookmarks = () =>
  browserBookmarkStore?.get(browserBookmarkAtom);
