import { SearchBar, XStack } from '@onekeyhq/components';
import type { IAccountNFT } from '@onekeyhq/shared/types/nft';

import { WalletListHeaderToolBar } from '../../../../components/TokenListView/TokenListHeader';

type IProps = {
  nfts: IAccountNFT[];
};

function NFTListHeader(props: IProps) {
  const { nfts } = props;

  if (nfts.length > 0) return <WalletListHeaderToolBar />;

  return null;
}

export { NFTListHeader };
