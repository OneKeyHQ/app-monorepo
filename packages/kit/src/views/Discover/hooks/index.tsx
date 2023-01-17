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
  const [dapps, setDapps] = useState<Record<string, DAppItemType>>({});
  const hostMap = useHistoryHostMap();
  const userBrowserHistories = useAppSelector(
    (s) => s.discover.userBrowserHistories,
  );

  const dappsIds = useMemo(() => {
    if (!userBrowserHistories) {
      return [];
    }
    return userBrowserHistories
      .filter((s) => s.dappId)
      .map((o) => o.dappId) as string[];
  }, [userBrowserHistories]);

  useEffect(() => {
    if (dappsIds && dappsIds.length) {
      backgroundApiProxy.serviceDiscover
        .getDappsByIds(dappsIds)
        .then((itemDapps) => {
          setDapps(
            itemDapps.reduce((result, item) => {
              result[item._id] = item;
              return result;
            }, {} as Record<string, DAppItemType>),
          );
        });
    }
  }, [dappsIds]);

  return useMemo<MatchDAppItemType[]>(() => {
    if (!userBrowserHistories) {
      return [];
    }
    return userBrowserHistories.map((item) => {
      const { dappId, url } = item;
      if (dappId && dapps[dappId]) {
        const dapp = dapps[dappId];
        return { id: dapp._id, dapp };
      }
      const { host } = new URL(url);
      const website = hostMap[host];
      return {
        id: url,
        webSite: {
          url,
          title: item.title ?? website?.title,
          favicon: item.logoUrl ?? website.favicon,
        },
      };
    });
  }, [userBrowserHistories, dapps, hostMap]);
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

export function useFavoritesDapps() {
  const [dapps, setDapps] = useState<DAppItemType[]>([]);

  const dappFavorites = useAppSelector((s) => s.discover.dappFavorites);

  const origins = useMemo(() => {
    if (!dappFavorites) {
      return [];
    }
    return dappFavorites.map((item) => {
      const url = new URL(item);
      return url.origin;
    });
  }, [dappFavorites]);
  useEffect(() => {
    if (origins.length > 0) {
      backgroundApiProxy.serviceDiscover
        .searchDappsWithRegExp(origins)
        .then(setDapps);
    }
  }, [origins]);
  const dappsHostMap = useMemo(() => {
    const hostMap: Record<string, DAppItemType> = {};
    for (let i = 0; i < dapps.length; i += 1) {
      const item = dapps[i];
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
    return hostMap;
  }, [dapps]);
  return { dappsHostMap, dapps };
}

export function useDiscoverFavorites(): MatchDAppItemType[] {
  const webSiteHostMap = useHistoryHostMap();
  const dappFavorites = useAppSelector((s) => s.discover.dappFavorites);
  const { dappsHostMap } = useFavoritesDapps();

  return useMemo(() => {
    if (!dappFavorites) {
      return [];
    }
    const items: MatchDAppItemType[] = [];
    for (const item of dappFavorites) {
      const url = new URL(item);
      const { host } = url;
      if (host) {
        const dapp = dappsHostMap[host] ?? dappsHostMap[getShortHost(host)];
        if (dapp) {
          items.push({ id: item, dapp });
        } else {
          const webSite = webSiteHostMap[host];
          if (webSite) {
            items.push({ id: item, webSite });
          }
        }
      }
    }
    return items;
  }, [dappFavorites, dappsHostMap, webSiteHostMap]);
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
