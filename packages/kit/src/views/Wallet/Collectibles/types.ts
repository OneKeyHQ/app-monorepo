import { NFTScanAsset } from '@onekeyhq/engine/src/types/nftscan';
import type { Collectible } from '@onekeyhq/engine/src/types/nftscan';

export type CollectibleGalleryProps = {
  isLoading: boolean;
  isSupported: boolean;
  collectibles: Collectible[];
  fetchData: () => void;
  onSelectCollectible?: (cols: Collectible) => void;
  onSelectAsset?: (asset: NFTScanAsset) => void;
};
