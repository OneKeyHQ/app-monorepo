import Fuse from 'fuse.js';

import type { TExchangeRate } from '@onekeyhq/kit/src/store/reducers/fiatMoney';

export const fuseSearch = (list: TExchangeRate[], keyword: string) => {
  const options = {
    includeScore: false,
    keys: ['name', 'unit', 'key'],
    threshold: 0.2,
  };
  const fuse = new Fuse(list, options);
  const result = fuse.search(keyword).map((item) => item.item);
  const cryptoRes = result.filter((item) => item.type?.includes('crypto'));
  const fiatRes = result.filter((item) => item.type?.includes('fiat'));
  let resSectionList: { title: string; data: string[] }[] = [];
  if (cryptoRes.length) {
    resSectionList = [
      ...resSectionList,
      {
        title: 'crypto',
        data: cryptoRes.map((item) => item.key ?? ''),
      },
    ];
  }
  if (fiatRes.length) {
    resSectionList = [
      ...resSectionList,
      {
        title: 'fiat',
        data: fiatRes.map((item) => item.key ?? ''),
      },
    ];
  }
  return resSectionList;
};
