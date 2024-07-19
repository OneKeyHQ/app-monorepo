import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { useTabIsRefreshingFocused } from '@onekeyhq/components';
import type { ITabPageProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  POLLING_DEBOUNCE_INTERVAL,
  POLLING_INTERVAL_FOR_NFT,
} from '@onekeyhq/shared/src/consts/walletConsts';
import type {
  IAccountNFT,
  IFetchAccountNFTsResp,
} from '@onekeyhq/shared/types/nft';

import { useAllNetworkRequests } from '../../../hooks/useAllNetwork';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  useNFTListActions,
  withNFTListProvider,
} from '../../../states/jotai/contexts/nftList';
import { NFTListView } from '../components/NFTListView';

const networkIdsMap = getNetworkIdsMap();

function NFTListContainer(props: ITabPageProps) {
  const { onContentSizeChange } = props;
  const { isFocused, isHeaderRefreshing, setIsHeaderRefreshing } =
    useTabIsRefreshingFocused();
  const { updateSearchKey } = useNFTListActions().current;
  const [nftListState, setNftListState] = useState({
    initialized: false,
    isRefreshing: false,
  });
  const refreshAllNetworksNftList = useRef(false);
  const [nftList, setNftList] = useState<IAccountNFT[]>([]);
  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num: 0 });

  const { run } = usePromiseResult(
    async () => {
      if (!account || !network) return;

      if (network.isAllNetworks) return;

      await backgroundApiProxy.serviceNFT.abortFetchAccountNFTs();
      const r = await backgroundApiProxy.serviceNFT.fetchAccountNFTs({
        accountId: account.id,
        networkId: network.id,
      });

      setNftListState({
        initialized: true,
        isRefreshing: false,
      });
      setIsHeaderRefreshing(false);

      setNftList(r.data);

      return r.data;
    },
    [account, network, setIsHeaderRefreshing],
    {
      overrideIsFocused: (isPageFocused) => isPageFocused && isFocused,
      debounced: POLLING_DEBOUNCE_INTERVAL,
      pollingInterval: POLLING_INTERVAL_FOR_NFT,
    },
  );

  const handleAllNetworkRequests = useCallback(
    async ({
      accountId,
      networkId,
    }: {
      accountId: string;
      networkId: string;
    }) => {
      const r = await backgroundApiProxy.serviceNFT.fetchAccountNFTs({
        accountId,
        networkId,
        isAllNetworks: true,
      });
      if (
        !refreshAllNetworksNftList.current &&
        r.networkId === networkIdsMap.all
      ) {
        setNftList((prev) => [...prev, ...r.data]);
        setNftListState({
          initialized: true,
          isRefreshing: false,
        });
      }

      return r;
    },
    [],
  );

  const handleClearAllNetworkData = useCallback(() => setNftList([]), []);

  const { result: allNetworksResult, isEmptyAccount } =
    useAllNetworkRequests<IFetchAccountNFTsResp>({
      account,
      network,
      wallet,
      allNetworkRequests: handleAllNetworkRequests,
      clearAllNetworkData: handleClearAllNetworkData,
      isNFTRequests: true,
    });

  useEffect(() => {
    if (refreshAllNetworksNftList.current && allNetworksResult) {
      let allNetworksNftList: IAccountNFT[] = [];
      for (const r of allNetworksResult) {
        allNetworksNftList = allNetworksNftList.concat(r.data);
      }

      setNftList(allNetworksNftList);
    }
  }, [allNetworksResult]);

  useEffect(() => {
    if (account?.id && network?.id && wallet?.id) {
      setNftListState({
        initialized: false,
        isRefreshing: true,
      });
      updateSearchKey('');
      refreshAllNetworksNftList.current = false;
      void backgroundApiProxy.serviceNFT.updateCurrentNetworkId({
        networkId: network.id,
      });
    }
  }, [account?.id, network?.id, updateSearchKey, wallet?.id]);

  useEffect(() => {
    if (isHeaderRefreshing) {
      void run();
    }
  }, [isHeaderRefreshing, run]);

  useEffect(() => {
    if (isEmptyAccount) {
      setNftList([]);
      setNftListState({
        initialized: true,
        isRefreshing: false,
      });
    }
  }, [isEmptyAccount]);

  return (
    <NFTListView
      inTabList
      data={nftList ?? []}
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
