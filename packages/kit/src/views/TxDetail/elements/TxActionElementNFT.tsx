import React from 'react';

import { NFTAsset } from '@onekeyhq/engine/src/types/nft';

import CollectibleListImage from '../../Wallet/NFT/NFTList/CollectibleListImage';

function TxActionElementNFT(props: { asset: NFTAsset }) {
  const { asset } = props;
  return <CollectibleListImage asset={asset} borderRadius="6px" size={96} />;
}

export { TxActionElementNFT };
