import type { IOverviewAccountTokensResult } from '@onekeyhq/kit-bg/src/services/ServiceOverview';

import {
  atom,
  createJotaiContext,
} from '../../../store/jotai/createJotaiContext';

// TODO rename to atomOverviewHomeData
export const atomHomeOverviewAccountTokens = atom<IOverviewAccountTokensResult>(
  {
    tokens: [],
    tokensTotal: 0,
    tokensTotalValue: undefined,
    tokensTotalValue24h: undefined,
  },
);

export const atomTokenAssetsListLoading = atom<boolean>(false);

const {
  withProvider: withProviderAssetsList,
  useContextAtom: useAtomAssetsList,
} = createJotaiContext();

export { useAtomAssetsList, withProviderAssetsList };
