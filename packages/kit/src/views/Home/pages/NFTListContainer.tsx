import { useEffect, useState } from 'react';

import { useTabIsRefreshingFocused } from '@onekeyhq/components';
import type { ITabPageProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  POLLING_DEBOUNCE_INTERVAL,
  POLLING_INTERVAL_FOR_NFT,
} from '@onekeyhq/shared/src/consts/walletConsts';

import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { NFTListView } from '../components/NFTListView';

function NFTListContainer(props: ITabPageProps) {
  const { onContentSizeChange } = props;
  const { isFocused } = useTabIsRefreshingFocused();
  const [nftListState, setNftListState] = useState({
    initialized: false,
    isRefreshing: false,
  });
  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num: 0 });

  const nfts = usePromiseResult(
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

      return r.data;
    },
    [account, network],
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
    }
  }, [account?.id, network?.id, wallet?.id]);

  return (
    <NFTListView
      data={nfts.result ?? []}
      isLoading={nftListState.isRefreshing}
      onContentSizeChange={onContentSizeChange}
      initialized={nftListState.initialized}
    />
  );
}

export { NFTListContainer };
