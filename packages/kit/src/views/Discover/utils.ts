import type { MatchDAppItemType } from './Explorer/explorerUtils';
import type { DAppItemType } from './type';

export const getUrlHost = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

export const convertMatchDAppItemType = (
  item: MatchDAppItemType,
): DAppItemType => {
  const name = item.dapp?.name || item.webSite?.title || '';
  const subtitle = item.dapp?.subtitle || '';
  const url = item.dapp?.url || item.webSite?.url || '';
  const logoURL = item.dapp?.logoURL || item.webSite?.favicon || '';
  const networkIds = item.dapp?.networkIds || [];
  return {
    _id: item.id,
    name,
    subtitle: subtitle || getUrlHost(url),
    url,
    logoURL,
    networkIds,
  };
};
