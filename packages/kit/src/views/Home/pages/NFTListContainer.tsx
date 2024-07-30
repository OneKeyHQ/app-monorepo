import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { uniqBy } from 'lodash';

import { useTabIsRefreshingFocused } from '@onekeyhq/components';
import type { ITabPageProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  POLLING_DEBOUNCE_INTERVAL,
  POLLING_INTERVAL_FOR_NFT,
} from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EHomeTab } from '@onekeyhq/shared/types';
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
    activeAccount: { account, allNetworkDbAccounts, network, wallet },
  } = useActiveAccount({ num: 0 });

  const { run } = usePromiseResult(
    async () => {
      if (!account || !network) return;

      if (network.isAllNetworks) return;

      appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
        isRefreshing: true,
        type: EHomeTab.NFT,
      });

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

      appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
        isRefreshing: false,
        type: EHomeTab.NFT,
      });

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
      allNetworkDataInit,
    }: {
      accountId: string;
      networkId: string;
      allNetworkDataInit?: boolean;
    }) => {
      const r = await backgroundApiProxy.serviceNFT.fetchAccountNFTs({
        accountId,
        networkId,
        isAllNetworks: true,
      });
      if (
        !allNetworkDataInit &&
        !refreshAllNetworksNftList.current &&
        r.networkId === networkIdsMap.onekeyall
      ) {
        setNftList((prev) =>
          uniqBy(
            [...prev, ...r.data],
            (nft) => `${nft.collectionAddress}_${nft.itemId}`,
          ),
        );
        setNftListState({
          initialized: true,
          isRefreshing: false,
        });
      }

      return r;
    },
    [],
  );

  const handleAllNetworkRequestsFinished = useCallback(() => {
    appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
      isRefreshing: false,
      type: EHomeTab.NFT,
    });
  }, []);

  const handleAllNetworkRequestsStarted = useCallback(() => {
    appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
      isRefreshing: true,
      type: EHomeTab.NFT,
    });
  }, []);

  const handleClearAllNetworkData = useCallback(() => setNftList([]), []);

  const {
    run: runAllNetworkRequests,
    result: allNetworksResult,
    isEmptyAccount,
  } = useAllNetworkRequests<IFetchAccountNFTsResp>({
    allNetworkDbAccounts,
    network,
    wallet,
    allNetworkRequests: handleAllNetworkRequests,
    clearAllNetworkData: handleClearAllNetworkData,
    isNFTRequests: true,
    onStarted: handleAllNetworkRequestsStarted,
    onFinished: handleAllNetworkRequestsFinished,
  });

  const handleRefreshAllNetworkData = useCallback(() => {
    refreshAllNetworksNftList.current = true;
    void runAllNetworkRequests();
  }, [runAllNetworkRequests]);

  useEffect(() => {
    if (refreshAllNetworksNftList.current && allNetworksResult) {
      let allNetworksNftList: IAccountNFT[] = [];
      for (const r of allNetworksResult) {
        allNetworksNftList = allNetworksNftList.concat(r.data);
      }

      setNftList(
        uniqBy(
          allNetworksNftList,
          (nft) => `${nft.collectionAddress}_${nft.itemId}`,
        ),
      );
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

  useEffect(() => {
    const refresh = () => {
      if (network?.isAllNetworks) {
        void handleRefreshAllNetworkData();
      } else {
        void run();
      }
    };

    const fn = () => {
      if (isFocused) {
        refresh();
      }
    };
    appEventBus.on(EAppEventBusNames.AccountDataUpdate, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.AccountDataUpdate, fn);
    };
  }, [handleRefreshAllNetworkData, isFocused, network?.isAllNetworks, run]);

  return (
    <NFTListView
      inTabList
      data={nftList ?? []}
      isLoading={nftListState.isRefreshing}
      initialized={nftListState.initialized}
      isAllNetworks={network?.isAllNetworks}
    />
  );
}

const NFTListContainerWithProvider = memo(
  withNFTListProvider(NFTListContainer),
);

export { NFTListContainerWithProvider };
