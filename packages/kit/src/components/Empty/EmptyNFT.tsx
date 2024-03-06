import { Empty } from '@onekeyhq/components';

function EmptyNFT() {
  return (
    <Empty
      testID="Wallet-No-NFT-Empty"
      icon="AiImagesOutline"
      title="No NFTs"
      description="No NFTs found at this address"
    />
  );
}

export { EmptyNFT };
