import { useEffect, useMemo, useState } from 'react';

import { useAppSelector } from '@onekeyhq/kit/src/hooks';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import type { MatchDAppItemType } from '../Explorer/explorerUtils';
import type { DAppItemType, WebSiteHistory } from '../type';

export function useAllDapps(): DAppItemType[] {
  return useAppSelector((s) => s.discover.dappItems || []);
}

const getShortHost = (host: string) => host.split('.').slice(-2).join('.');

export function useAllDappMap(): {
  idsMap: Record<string, DAppItemType>;
  hostMap: Record<string, DAppItemType>;
} {
  const allDapps = useAllDapps();
  const idsMap: Record<string, DAppItemType> = {};
  const hostMap: Record<string, DAppItemType> = {};
  for (let i = 0; i < allDapps.length; i += 1) {
    const item = allDapps[i];
    idsMap[item._id] = item;
    if (item.url) {
      const { host } = new URL(item.url);
      if (host) {
        hostMap[host] = item;
      } else {
        const shortHost = getShortHost(host);
        if (shortHost) {
          hostMap[shortHost] = item;
        }
      }
    }
  }
  return { idsMap, hostMap };
}

export function useHistoryHostMap(): Record<string, WebSiteHistory> {
  const history = useAppSelector((s) => s.discover.history);
  return useMemo(() => {
    const hostMap: Record<string, WebSiteHistory> = {};
    Object.values(history).forEach(({ webSite }) => {
      if (webSite) {
        const { url } = webSite;
        if (url) {
          const { host } = new URL(url);
          hostMap[host] = webSite;
        }
      }
    });
    return hostMap;
  }, [history]);
}

export function useUserBrowserHistories(): MatchDAppItemType[] {
  const userBrowserHistories = useAppSelector(
    (s) => s.discover.userBrowserHistories,
  );
  return useMemo(() => {
    if (!userBrowserHistories) {
      return [];
    }
    return userBrowserHistories.map((item) => ({
      id: item.url,
      webSite: {
        url: item.url,
        title: item.title,
        favicon: item.logoUrl,
      },
    }));
  }, [userBrowserHistories]);
}

export function useDiscoverHistory(): MatchDAppItemType[] {
  const [items, setItems] = useState<MatchDAppItemType[]>([]);
  const dappHistory = useAppSelector((s) => s.discover.dappHistory);

  const dappsIds = useMemo(() => {
    if (!dappHistory) {
      return [];
    }
    return Object.entries(dappHistory)
      .sort((a, b) => b[1].timestamp - a[1].timestamp)
      .map((o) => o[0])
      .filter((item) => !Number.isNaN(item));
  }, [dappHistory]);

  useEffect(() => {
    if (dappsIds) {
      backgroundApiProxy.serviceDiscover
        .getDappsByIds(dappsIds)
        .then((itemDapps) => {
          setItems(itemDapps.map((o) => ({ id: o._id, dapp: o })));
        });
    }
  }, [dappsIds]);
  return items;
}

export function useDiscoverFavorites(): MatchDAppItemType[] {
  const bookmarks = useAppSelector((s) => s.discover.bookmarks);
  return useMemo(() => {
    if (!bookmarks) {
      return [];
    }
    return bookmarks.map((bookmark) => ({
      id: bookmark.url,
      webSite: {
        title: bookmark.title,
        favicon: bookmark.icon,
        url: bookmark.url,
      },
    }));
  }, [bookmarks]);
}

export function useTaggedDapps() {
  const home = useAppSelector((s) => s.discover.home);
  return useMemo(() => {
    if (!home) {
      return [];
    }
    return home.tagDapps.filter((item) => item.items.length > 0);
  }, [home]);
}

export function useCategoryDapps(categoryId?: string): DAppItemType[] {
  const [categoryDapps, setCategoryDapps] = useState<DAppItemType[]>([]);
  useEffect(() => {
    if (categoryId) {
      backgroundApiProxy.serviceDiscover
        .getCategoryDapps(categoryId)
        .then(setCategoryDapps);
    }
  }, [categoryId]);
  return categoryDapps;
}

export function useTagDapps(tagId: string) {
  const [tagDapps, setTagDapps] = useState<DAppItemType[]>([]);
  useEffect(() => {
    if (tagId) {
      backgroundApiProxy.serviceDiscover.getTagDapps(tagId).then(setTagDapps);
    }
  }, [tagId]);
  return tagDapps;
}

export function useCategories() {
  const home = useAppSelector((s) => s.discover.home);
  return useMemo(() => {
    if (!home) {
      return [];
    }
    return home.categories;
  }, [home]);
}

export function useShowBookmark() {
  const isApple = platformEnv.isNativeIOS || platformEnv.isMas;
  const showBookmark = useAppSelector((s) => s.discover.showBookmark);
  const hideDiscoverContent = useAppSelector(
    (s) => s.settings.devMode?.hideDiscoverContent,
  );
  return useMemo(() => {
    if (hideDiscoverContent) {
      return false;
    }
    if (!isApple) {
      return true;
    }
    return showBookmark;
  }, [showBookmark, isApple, hideDiscoverContent]);
}
