import { MoralisNFT } from '@onekeyhq/engine/src/types/moralis';
import type { Collectible } from '@onekeyhq/engine/src/types/moralis';

export enum CollectibleView {
  Expand = 'Expand',
  Packup = 'Packup',
}

export type CollectibleGalleryProps = {
  isLoading: boolean;
  isSupported: boolean;
  collectibles: Collectible[];
  fetchData: () => void;
  onSelectCollectible?: (cols: Collectible) => void;
  onSelectAsset?: (asset: MoralisNFT) => void;
};
