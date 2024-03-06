import { debounce } from 'lodash';

import { ListToolToolBar } from '@onekeyhq/kit/src/components/ListToolBar';
import {
  ENABLE_SEARCH_NFT_LIST_MIN_LENGTH,
  SEARCH_DEBOUNCE_INTERVAL,
  SEARCH_KEY_MIN_LENGTH,
} from '@onekeyhq/shared/src/consts/walletConsts';
import type { IAccountNFT } from '@onekeyhq/shared/types/nft';

type IProps = {
  nfts: IAccountNFT[];
  filteredNfts: IAccountNFT[];
  searchKey: string;
  setSearchKey: (key: string) => void;
};

function NFTListHeader(props: IProps) {
  const { nfts, filteredNfts, searchKey, setSearchKey } = props;
  return (
    <ListToolToolBar
      searchProps={
        nfts.length >= ENABLE_SEARCH_NFT_LIST_MIN_LENGTH
          ? {
              onChangeText: debounce(
                (text) => setSearchKey(text),
                SEARCH_DEBOUNCE_INTERVAL,
              ),
              searchResultCount:
                searchKey && searchKey.length >= SEARCH_KEY_MIN_LENGTH
                  ? filteredNfts.length
                  : 0,
            }
          : undefined
      }
    />
  );
}

export { NFTListHeader };
