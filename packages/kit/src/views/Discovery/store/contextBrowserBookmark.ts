import {
  atom,
  createJotaiContext,
} from '../../../store/jotai/createJotaiContext';

import { homeTab } from './contextWebTabs';

import type { IBrowserBookmark } from '../types';

export const {
  withProvider: withProviderBrowserBookmark,
  useContextAtom: useAtomBrowserBookmark,
  store: browserBookmarkStore,
} = createJotaiContext({
  isSingletonStore: true,
});

export const browserBookmarkAtom = atom<IBrowserBookmark[]>([]);

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
    set(browserBookmarkAtom, bookmark);
    console.log('===>set browserBookmarkAtom: ', bookmark);
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
    set(browserBookmarkAtom, bookmark);
  },
);

export const getBrowserBookmarks = () =>
  browserBookmarkStore?.get(browserBookmarkAtom);
