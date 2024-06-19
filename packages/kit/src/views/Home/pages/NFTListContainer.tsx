import { memo, useEffect, useState } from 'react';

import { useTabIsRefreshingFocused } from '@onekeyhq/components';
import type { ITabPageProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  POLLING_DEBOUNCE_INTERVAL,
  POLLING_INTERVAL_FOR_NFT,
} from '@onekeyhq/shared/src/consts/walletConsts';

import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  useNFTListActions,
  withNFTListProvider,
} from '../../../states/jotai/contexts/nftList';
import { NFTListView } from '../components/NFTListView';

function NFTListContainer(props: ITabPageProps) {
  const { onContentSizeChange } = props;
  const { isFocused, isHeaderRefreshing, setIsHeaderRefreshing } =
    useTabIsRefreshingFocused();
  const { updateSearchKey } = useNFTListActions().current;
  const [nftListState, setNftListState] = useState({
    initialized: false,
    isRefreshing: false,
  });
  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num: 0 });

  const { result, run } = usePromiseResult(
    async () => {
      if (!account || !network) return;
      const r = await backgroundApiProxy.serviceNFT.fetchAccountNFTs({
        networkId: network.id,
        accountAddress: account.address,
        xpub: await backgroundApiProxy.serviceAccount.getAccountXpub({
          accountId: account.id,
          networkId: network.id,
        }),
      });

      setNftListState({
        initialized: true,
        isRefreshing: false,
      });
      setIsHeaderRefreshing(false);

      return r.data;
    },
    [account, network, setIsHeaderRefreshing],
    {
      overrideIsFocused: (isPageFocused) => isPageFocused && isFocused,
      debounced: POLLING_DEBOUNCE_INTERVAL,
      pollingInterval: POLLING_INTERVAL_FOR_NFT,
    },
  );

  useEffect(() => {
    if (account?.id && network?.id && wallet?.id) {
      setNftListState({
        initialized: false,
        isRefreshing: true,
      });
      updateSearchKey('');
    }
  }, [account?.id, network?.id, updateSearchKey, wallet?.id]);

  useEffect(() => {
    if (isHeaderRefreshing) {
      void run();
    }
  }, [isHeaderRefreshing, run]);

  return (
    <NFTListView
      data={result ?? []}
      isLoading={nftListState.isRefreshing}
      onContentSizeChange={onContentSizeChange}
      initialized={nftListState.initialized}
    />
  );
}

const NFTListContainerWithProvider = memo(
  withNFTListProvider(NFTListContainer),
);

export { NFTListContainerWithProvider };
