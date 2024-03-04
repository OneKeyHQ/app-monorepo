import { debounce } from 'lodash';

import { ListToolToolBar } from '@onekeyhq/kit/src/components/ListToolBar';
import type { IAccountNFT } from '@onekeyhq/shared/types/nft';

type IProps = {
  nfts: IAccountNFT[];
  setSearchKey: (key: string) => void;
};

function NFTListHeader(props: IProps) {
  const { nfts, setSearchKey } = props;
  return (
    <ListToolToolBar
      searchProps={
        nfts.length > 0
          ? {
              onChangeText: debounce(
                (searchKey) => setSearchKey(searchKey),
                800,
              ),
            }
          : undefined
      }
    />
  );
}

export { NFTListHeader };
