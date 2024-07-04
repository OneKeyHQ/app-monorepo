import { buildFuse } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import type { IServerNetworkMatch } from '../types';

export const networkFuseSearch = (
  networks: IServerNetwork[],
  searchText: string,
): IServerNetworkMatch[] => {
  const implArr = ['evm', 'dot', 'cosmos'];

  const symbolSet = new Set<string>();
  const shortnameSet = new Set<string>();

  // exact match symbol, shortname
  networks.forEach((network) => {
    symbolSet.add(network.symbol.toLowerCase());
    shortnameSet.add(network.shortname.toLowerCase());
  });

  const searchTextLower = searchText.toLowerCase();

  const keys = ['name'];
  if (implArr.includes(searchTextLower)) {
    keys.push('impl');
  }
  if (symbolSet.has(searchTextLower)) {
    keys.push('symbol');
  }
  if (shortnameSet.has(searchTextLower)) {
    keys.push('shortname');
  }
  const fuse = buildFuse(networks, { keys });

  const data = fuse.search(searchText).map((o) => ({
    ...o.item,
    titleMatch: o.matches?.find((i) => i.key === 'name'),
  }));
  return data;
};
