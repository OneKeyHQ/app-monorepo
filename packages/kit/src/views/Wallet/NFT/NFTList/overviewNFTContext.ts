import type { IOverviewAccountNFTResult } from '@onekeyhq/kit-bg/src/services/ServiceOverview';

import {
  atom,
  createJotaiContext,
} from '../../../../store/jotai/createJotaiContext';

export const atomHomeOverviewNFTList = atom<IOverviewAccountNFTResult>({
  nfts: [],
  nftKeys: [],
});

export const atomHomeOverviewNFTListLoading = atom<boolean>(false);

const { withProvider: withProviderNFTList, useContextAtom: useAtomNFTList } =
  createJotaiContext();

export { withProviderNFTList, useAtomNFTList };
