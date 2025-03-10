

import { CommonAssetContent } from '../components/NFT/NFTDetails/CommonAsset/CommonAssetContent';
import { CommonAssetImage } from '../components/NFT/NFTDetails/CommonAsset/CommonAssetImage';

export function getNFTDetailsComponents(impl?: string) {
  switch (impl) {
    // TODO: add other impl
    default:
      return {
        ImageContent: CommonAssetImage,
        DetailContent: CommonAssetContent,
      };
  }
}
