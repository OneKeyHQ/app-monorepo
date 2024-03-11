import { useRef, useState } from 'react';

import { Empty, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  POLLING_DEBOUNCE_INTERVAL,
  POLLING_INTERVAL_FOR_NFT,
} from '@onekeyhq/shared/src/consts/walletConsts';

import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { NFTListView } from '../components/NFTListView';

type IProps = {
  onContentSizeChange?: ((w: number, h: number) => void) | undefined;
};

function NFTListContainer(props: IProps) {
  const { onContentSizeChange } = props;
  const [initialized, setInitialized] = useState(false);

  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });

  const currentAccountId = useRef<string>('');

  const nfts = usePromiseResult(
    async () => {
      if (!account || !network) return;
      if (currentAccountId.current !== account.id) {
        currentAccountId.current = account.id;
        setInitialized(false);
      }
      const r = await backgroundApiProxy.serviceNFT.fetchAccountNFTs({
        networkId: network.id,
        accountAddress: account.address,
        xpub: await backgroundApiProxy.serviceAccount.getAccountXpub({
          accountId: account.id,
          networkId: network.id,
        }),
      });

      setInitialized(true);

      return r.data;
    },
    [account, network],
    {
      watchLoading: true,
      debounced: POLLING_DEBOUNCE_INTERVAL,
      pollingInterval: POLLING_INTERVAL_FOR_NFT,
    },
  );

  return (
    <NFTListView
      data={nfts.result ?? []}
      isLoading={nfts.isLoading}
      onContentSizeChange={onContentSizeChange}
      initialized={initialized}
    />
  );
}

export { NFTListContainer };
