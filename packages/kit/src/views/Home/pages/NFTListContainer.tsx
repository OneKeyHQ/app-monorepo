import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { NFTListView } from '../components/NFTListView';
import { DEBOUNCE_INTERVAL, POLLING_INTERVAL_FOR_NFT } from '../constants';

type IProps = {
  onContentSizeChange?: ((w: number, h: number) => void) | undefined;
};

function NFTListContainer(props: IProps) {
  const { onContentSizeChange } = props;

  const nfts = usePromiseResult(
    async () => {
      const r = await backgroundApiProxy.serviceNFT.fetchAccountNFTs({
        networkId: 'evm--1',
        accountAddress: '0xA9b4d559A98ff47C83B74522b7986146538cD4dF',
      });
      return r.data;
    },
    [],
    {
      debounced: DEBOUNCE_INTERVAL,
      pollingInterval: POLLING_INTERVAL_FOR_NFT,
    },
  );

  return (
    <NFTListView
      data={nfts.result ?? []}
      isLoading={nfts.isLoading}
      onContentSizeChange={onContentSizeChange}
    />
  );
}

export { NFTListContainer };
