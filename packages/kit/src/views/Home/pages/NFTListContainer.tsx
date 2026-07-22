import { memo, useEffect } from 'react';

import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { useHomeResource } from '../../../states/jotai/contexts/home';
import {
  useNFTListActions,
  withNFTListProvider,
} from '../../../states/jotai/contexts/nftList';
import { NFTListView } from '../components/NFTListView';
import { useHomeSectionPayload } from '../model/react/homeStoreHooks';
import { useHomeRefreshIntents } from '../model/react/useHomeRefreshIntents';

function NFTListContainer() {
  const { updateSearchKey } = useNFTListActions().current;
  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num: 0 });
  const homeNFTResource = useHomeResource('nft');
  const homeNFTPayload = useHomeSectionPayload('nft');
  const { refreshSection, refreshingBySection } = useHomeRefreshIntents();

  useEffect(() => {
    updateSearchKey('');
  }, [account?.id, network?.id, updateSearchKey, wallet?.id]);

  const initialized =
    homeNFTPayload !== undefined ||
    homeNFTResource.kind === 'empty' ||
    homeNFTResource.kind === 'error';

  return (
    <NFTListView
      onRefresh={() => refreshSection('nft')}
      refreshing={refreshingBySection.nft}
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
