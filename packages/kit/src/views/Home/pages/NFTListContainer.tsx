import { Empty, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { NFTListView } from '../components/NFTListView';
import { DEBOUNCE_INTERVAL, POLLING_INTERVAL_FOR_NFT } from '../constants';

type IProps = {
  onContentSizeChange?: ((w: number, h: number) => void) | undefined;
};

function NFTListContainer(props: IProps) {
  const { onContentSizeChange } = props;

  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });

  const isNFTEnabled = usePromiseResult(
    () =>
      backgroundApiProxy.serviceNFT.getIsNetworkNFTEnabled({
        networkId: network?.id ?? '',
      }),
    [network?.id],
  ).result;

  const nfts = usePromiseResult(
    async () => {
      if (!account || !network || !isNFTEnabled) return;
      const r = await backgroundApiProxy.serviceNFT.fetchAccountNFTs({
        networkId: network.id,
        accountAddress: account.address,
      });

      return r.data;
    },
    [account, isNFTEnabled, network],
    {
      debounced: DEBOUNCE_INTERVAL,
      pollingInterval: POLLING_INTERVAL_FOR_NFT,
    },
  );

  if (!isNFTEnabled) {
    return (
      <Stack h="100%" alignItems="center" justifyContent="center">
        <Empty
          title="Not Supported"
          description="The chain does support NFT yet."
        />
      </Stack>
    );
  }

  return (
    <NFTListView
      data={nfts.result ?? []}
      isLoading={nfts.isLoading}
      onContentSizeChange={onContentSizeChange}
    />
  );
}

export { NFTListContainer };
