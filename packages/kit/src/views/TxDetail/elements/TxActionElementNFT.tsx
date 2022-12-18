import type { NFTAsset } from '@onekeyhq/engine/src/types/nft';

import NFTListImage from '../../Wallet/NFT/NFTList/NFTListImage';

function TxActionElementNFT(props: { asset: NFTAsset }) {
  const { asset } = props;
  return <NFTListImage asset={asset} borderRadius="6px" size={96} />;
}

export { TxActionElementNFT };
