import { buildFuse } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import type { IServerNetworkMatch } from '../types';

export const networkFuseSearch = (
  networks: IServerNetwork[],
  searchText: string,
): IServerNetworkMatch[] => {
  const implArr = ['evm', 'dot', 'cosmos'];
  const symbolSet = new Set(
    networks.map((network) => network.symbol.toLowerCase()),
  );
  const keys = ['name'];
  if (implArr.includes(searchText.toLowerCase())) {
    keys.push('impl');
  }
  if (symbolSet.has(searchText.toLowerCase())) {
    keys.push('symbol');
  }
  const fuse = buildFuse(networks, { keys });
  const data = fuse.search(searchText).map((o) => ({
    ...o.item,
    titleMatch: o.matches?.find((i) => i.key === 'name'),
  }));
  return data;
};
