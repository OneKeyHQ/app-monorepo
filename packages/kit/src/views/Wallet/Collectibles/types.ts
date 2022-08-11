import { NFTAsset } from '@onekeyhq/engine/src/types/nft';
import type { Collection } from '@onekeyhq/engine/src/types/nft';

export type CollectibleGalleryProps = {
  collectibles: Collection[];
  onSelectCollection?: (cols: Collection) => void;
  onSelectAsset?: (asset: NFTAsset) => void;
  fetchData?: () => void;
  isCollectibleSupported?: boolean;
  isLoading?: boolean;
};
