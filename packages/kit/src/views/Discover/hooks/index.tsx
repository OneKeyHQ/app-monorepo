import { useEffect, useMemo, useState } from 'react';

import { useAppSelector } from '@onekeyhq/kit/src/hooks';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import type { MatchDAppItemType } from '../Explorer/explorerUtils';
import type { DAppItemType, WebSiteHistory } from '../type';

export function useAllDapps(): DAppItemType[] {
  const dapps = useAppSelector((s) => s.discover.dappItems);
  return useMemo(() => dapps || [], [dapps]);
}

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
      const shortHost = host.split('.').slice(-2).join('.');
      if (host) {
        hostMap[host] = item;
      }
      if (shortHost) {
        hostMap[shortHost] = item;
      }
    }
  }
  return { idsMap, hostMap };
}

export function useHistoryHostMap(): Record<string, WebSiteHistory> {
  const history = useAppSelector((s) => s.discover.history);
  return useMemo(() => {
    const values = Object.values(history).filter((o) => o.webSite);
    const hostMap: Record<string, WebSiteHistory> = {};
    for (let i = 0; i < values.length; i += 1) {
      const item = values[i];
      if (item?.webSite) {
        const { webSite } = item;
        const { url } = webSite;
        if (url) {
          const { host } = new URL(url);
          hostMap[host] = webSite;
        }
      }
    }
    return hostMap;
  }, [history]);
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
    async function main() {
      if (dappsIds) {
        const itemDapps =
          await backgroundApiProxy.serviceDiscover.getDappsByIds(dappsIds);
        setItems(itemDapps.map((o) => ({ id: o._id, dapp: o })));
      }
    }
    main();
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
    async function main() {
      if (origins.length > 0) {
        const data =
          await backgroundApiProxy.serviceDiscover.searchDappsWithRegExp(
            origins,
          );
        setDapps(data);
      }
    }
    main();
  }, [origins]);
  const dappsHostMap = useMemo(() => {
    const hostMap: Record<string, DAppItemType> = {};
    for (let i = 0; i < dapps.length; i += 1) {
      const item = dapps[i];
      if (item.url) {
        const { host } = new URL(item.url);
        const shortHost = host.split('.').slice(-2).join('.');
        if (host) {
          hostMap[host] = item;
        }
        if (shortHost) {
          hostMap[shortHost] = item;
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
    let items = dappFavorites.map((item) => {
      const url = new URL(item);
      return { value: item, host: url.host };
    });
    items = items.filter((item) => item.host);
    return items
      .map((item) => {
        const { host } = item;
        const shortHost = host.split('.').slice(-2).join('.');
        const dapp = dappsHostMap[host] ?? dappsHostMap[shortHost];
        if (dapp) {
          return { id: item.value, dapp };
        }
        const webSite = webSiteHostMap[item.host];
        if (webSite) {
          return { id: item.value, webSite };
        }
        return undefined;
      })
      .filter(Boolean);
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
    async function main() {
      if (categoryId) {
        const dapps = await backgroundApiProxy.serviceDiscover.getCategoryDapps(
          categoryId,
        );
        setCategoryDapps(dapps);
      }
    }
    main();
  }, [categoryId]);
  return categoryDapps;
}

export function useTagDapps(tagId: string) {
  const [tagDapps, setTagDapps] = useState<DAppItemType[]>([]);
  useEffect(() => {
    async function main() {
      if (tagId) {
        const dapps = await backgroundApiProxy.serviceDiscover.getTagDapps(
          tagId,
        );
        setTagDapps(dapps);
      }
    }
    main();
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
  return useMemo(() => {
    if (!isApple) {
      return true;
    }
    return showBookmark;
  }, [showBookmark, isApple]);
}
