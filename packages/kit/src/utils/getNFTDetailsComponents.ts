import { IMPL_BTC, IMPL_SOL } from '@onekeyhq/shared/src/engine/engineConsts';

import { CommonAssetContent } from '../components/NFT/NFTDetails/CommonAsset/CommonAssetContent';
import { CommonAssetImage } from '../components/NFT/NFTDetails/CommonAsset/CommonAssetImage';

export function getNFTDetailsComponents(impl?: string) {
  switch (impl) {
    // TODO: add other impl
    case IMPL_BTC:
    case IMPL_SOL:
    default:
      return {
        ImageContent: CommonAssetImage,
        DetailContent: CommonAssetContent,
      };
  }
}
