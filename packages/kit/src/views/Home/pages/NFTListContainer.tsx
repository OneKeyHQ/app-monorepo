import { memo, useEffect } from 'react';

import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { useHomeResource } from '../../../states/jotai/contexts/home';
import {
  useNFTListActions,
  withNFTListProvider,
} from '../../../states/jotai/contexts/nftList';
import { NFTListView } from '../components/NFTListView';
import { onHomePageRefresh } from '../components/PullToRefresh';
import { useHomeSectionPayload } from '../model/react/homeStoreHooks';

function NFTListContainer() {
  const { updateSearchKey } = useNFTListActions().current;
  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num: 0 });
  const homeNFTResource = useHomeResource('nft');
  const homeNFTPayload = useHomeSectionPayload('nft');

  useEffect(() => {
    updateSearchKey('');
  }, [account?.id, network?.id, updateSearchKey, wallet?.id]);

  const initialized =
    homeNFTPayload !== undefined ||
    homeNFTResource.kind === 'empty' ||
    homeNFTResource.kind === 'error';

  return (
    <NFTListView
      onRefresh={onHomePageRefresh}
      data={homeNFTPayload?.data ?? []}
      isLoading={!initialized}
      initialized={initialized}
      isAllNetworks={network?.isAllNetworks}
    />
  );
}

const NFTListContainerWithProvider = memo(
  withNFTListProvider(NFTListContainer),
);
NFTListContainerWithProvider.displayName = 'NFTListContainerWithProvider';

export { NFTListContainerWithProvider };
