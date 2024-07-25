import { debounce } from 'lodash';

import { ListToolToolBar } from '@onekeyhq/kit/src/components/ListToolBar';
import {
  useNFTListActions,
  useSearchKeyAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/nftList';
import {
  SEARCH_DEBOUNCE_INTERVAL,
  SEARCH_KEY_MIN_LENGTH,
} from '@onekeyhq/shared/src/consts/walletConsts';
import type { IAccountNFT } from '@onekeyhq/shared/types/nft';

type IProps = {
  filteredNfts: IAccountNFT[];
};

function NFTListHeader(props: IProps) {
  const { filteredNfts } = props;
  const [searchKey] = useSearchKeyAtom();
  const { updateSearchKey } = useNFTListActions().current;
  return (
    <ListToolToolBar
      searchProps={{
        onChangeText: debounce(
          (text) => updateSearchKey(text),
          SEARCH_DEBOUNCE_INTERVAL,
        ),
        searchResultCount:
          searchKey && searchKey.length >= SEARCH_KEY_MIN_LENGTH
            ? filteredNfts.length
            : 0,
      }}
    />
  );
}

export { NFTListHeader };
