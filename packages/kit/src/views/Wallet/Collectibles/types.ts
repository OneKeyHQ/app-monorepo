import { Asset } from '@onekeyhq/engine/src/types/opensea';

export enum CollectibleView {
  Flat = 'Flat',
  Grid = 'Grid',
}

export type SelectedAsset = Asset & {
  chain?: string | null;
  contractAddress?: string | null;
};
