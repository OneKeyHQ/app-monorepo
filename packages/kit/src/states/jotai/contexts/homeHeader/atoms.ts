import type { IHomeHeaderData } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityHomePageData';

import { createJotaiContext } from '../../utils/createJotaiContext';

const {
  Provider: ProviderJotaiContextHomeHeader,
  withProvider: withHomeHeaderProvider,
  contextAtom,
  contextAtomMethod,
} = createJotaiContext();

export {
  ProviderJotaiContextHomeHeader,
  contextAtomMethod,
  withHomeHeaderProvider,
};

export const { atom: homeHeaderDataAtom, use: useHomeHeaderDataAtom } =
  contextAtom<IHomeHeaderData>({
    totalBalance: '0',
    tokenWorth: '0',
    defiNetWorth: '0',
    tokenWorthMap: {},
    createAtNetworkWorth: '0',
    accountId: '',
    initialized: false,
    isRefreshing: false,
  });
