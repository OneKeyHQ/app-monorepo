import { debounce } from 'lodash';

import { ListToolToolBar } from '@onekeyhq/kit/src/components/ListToolBar';
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
        nfts.length > 10
          ? {
              onChangeText: debounce((text) => setSearchKey(text), 800),
              searchResultCount:
                searchKey && searchKey.length > 2 ? filteredNfts.length : 0,
            }
          : undefined
      }
    />
  );
}

export { NFTListHeader };
