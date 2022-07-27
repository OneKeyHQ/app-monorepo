import { NFTScanAsset } from '@onekeyhq/engine/src/types/nftscan';

export type NFTProps = {
  loading?: boolean;
  url?: string;
  asset: NFTScanAsset;
  width?: number;
  height?: number;
};
