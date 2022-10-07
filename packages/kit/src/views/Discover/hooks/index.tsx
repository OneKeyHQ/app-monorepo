import { useMemo } from 'react';

import { useAppSelector } from '@onekeyhq/kit/src/hooks';

import { MatchDAppItemType } from '../Explorer/explorerUtils';
import { DAppItemType, WebSiteHistory } from '../type';

export function useAllDapps(): DAppItemType[] {
  const dapps = useAppSelector((s) => s.discover.dapps);
  return useMemo(() => {
    if (!dapps) {
      return [];
    }
    return dapps.reduce(
      (result, item) => result.concat(item.items),
      [] as DAppItemType[],
    );
  }, [dapps]);
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
  const { idsMap } = useAllDappMap();
  const dappHistory = useAppSelector((s) => s.discover.dappHistory);
  return useMemo(() => {
    if (!dappHistory) {
      return [];
    }
    return Object.entries(dappHistory)
      .sort((a, b) => b[1].timestamp - a[1].timestamp)
      .map((o) => idsMap[o[0]])
      .filter(Boolean)
      .map((e) => ({ id: e._id, dapp: e }));
  }, [dappHistory, idsMap]);
}

export function useDiscoverFavorites(): MatchDAppItemType[] {
  const { hostMap: dappHostMap } = useAllDappMap();
  const webSiteHostMap = useHistoryHostMap();
  const dappFavorites = useAppSelector((s) => s.discover.dappFavorites);

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
        const dapp = dappHostMap[host] ?? dappHostMap[shortHost];
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
  }, [dappFavorites, dappHostMap, webSiteHostMap]);
}
