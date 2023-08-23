import type { IManageTokensListingResult } from '@onekeyhq/kit-bg/src/services/ServiceToken';

import { atom, createJotaiContext } from '../../store/jotai/createJotaiContext';

export const atomMangeTokensLoading = atom<boolean>(false);
export const atomMangeTokensKeywords = atom<string>('');
export const atomMangeTokensRefreshTS = atom<number>(Date.now());
export const atomMangeHeaderTokens = atom<
  Pick<
    IManageTokensListingResult,
    'headerTokensKeys' | 'headerTokens' | 'headerTokenKeysMap'
  >
>({
  headerTokens: [],
  headerTokensKeys: [],
  headerTokenKeysMap: {},
});
export const atomMangeNetworksTokens = atom<
  Pick<IManageTokensListingResult, 'networkTokensKeys' | 'networkTokens'>
>({
  networkTokens: [],
  networkTokensKeys: [],
});

const {
  withProvider: withProviderManageTokens,
  useContextAtom: useAtomManageTokens,
} = createJotaiContext();

export { useAtomManageTokens, withProviderManageTokens };
