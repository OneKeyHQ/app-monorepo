import { OpenSeaAsset } from '@onekeyhq/engine/src/types/opensea';

export enum CollectibleView {
  Flat = 'Flat',
  Grid = 'Grid',
}

export type SelectedAsset = OpenSeaAsset & {
  chain?: string | null;
  contractAddress?: string | null;
};
