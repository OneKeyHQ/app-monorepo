import type { NFTAsset } from '@onekeyhq/engine/src/types/nft';

import {
  atom,
  createJotaiContext,
} from '../../../../store/jotai/createJotaiContext';

export type SelectAsset = NFTAsset & {
  selected: boolean;
  selectAmount: string;
};

type IContext = {
  data: NFTAsset[];
  multi: boolean;
};

export const atomSendNFTList = atom<IContext>({
  data: [],
  multi: false,
});

export const atomSelectedSendNFTList = atom<SelectAsset[]>([]);

const {
  withProvider: withProviderSendNFTList,
  useContextAtom: useAtomSendNFTList,
} = createJotaiContext();

export { withProviderSendNFTList, useAtomSendNFTList };
