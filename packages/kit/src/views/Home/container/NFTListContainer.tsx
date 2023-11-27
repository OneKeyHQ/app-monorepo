import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { NFTListView } from '../components/NFTListView';

type IProps = {
  onContentSizeChange?: ((w: number, h: number) => void) | undefined;
};

function NFTListContainer(props: IProps) {
  const { onContentSizeChange } = props;

  const nfts = usePromiseResult(async () => {
    const r = await backgroundApiProxy.serviceNFT.demoFetchAccountNFTs();
    return r.flatMap((item) => item.assets);
  }, []);

  return (
    <NFTListView
      data={nfts.result ?? []}
      isLoading={nfts.isLoading}
      onContentSizeChange={onContentSizeChange}
    />
  );
}

export { NFTListContainer };
