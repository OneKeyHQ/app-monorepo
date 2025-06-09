import { useCallback, useMemo } from 'react';

import {
  type IFuseExpression,
  buildBaseFuse,
} from '@onekeyhq/shared/src/modules3rdParty/fuse';
import type { IServerNetwork } from '@onekeyhq/shared/types';

const implArr = ['evm', 'dot', 'cosmos'];

export const useFuseSearch = (networks: IServerNetwork[]) => {
  const context = useMemo(() => {
    const fuse = buildBaseFuse(networks, {
      keys: ['name', 'impl', 'symbol', 'shortname'],
    });
    const symbolSet = new Set(networks.map((o) => o.symbol.toLowerCase()));
    const shortnameSet = new Set(
      networks.map((o) => o.shortname.toLowerCase()),
    );
    return { fuse, symbolSet, shortnameSet };
  }, [networks]);
  return useCallback(
    (searchText: string) => {
      const lowerSearchText = searchText.toLowerCase();
      const { fuse, symbolSet, shortnameSet } = context;
      const exp: IFuseExpression = {
        '$or': [{ name: `^${searchText}` }, { name: `'${searchText}` }],
      };
      if (implArr.includes(lowerSearchText)) {
        exp.$or?.push({ impl: `=${lowerSearchText}` });
      }
      if (symbolSet.has(lowerSearchText)) {
        exp.$or?.push({ symbol: `=${lowerSearchText}` });
      }
      if (shortnameSet.has(lowerSearchText)) {
        exp.$or?.push({ shortname: `=${lowerSearchText}` });
      }
      const searchResult = fuse.search(exp);
      const result = searchResult.map((o) => ({
        ...o.item,
        titleMatch: o.matches?.find((i) => i.key === 'name'),
      }));
      return result;
    },
    [context],
  );
};
