import type { ComponentProps } from 'react';

import type { Box } from '@onekeyhq/components';
import type {
  Collection,
  NFTAsset,
  NFTBTCAssetModel,
} from '@onekeyhq/engine/src/types/nft';

export type ListDataType = Collection | NFTAsset | NFTBTCAssetModel;

export enum NFTCardType {
  EVMAsset = 'EVMAsset',
  EVMCollection = 'EVMCollection',
  SOLAsset = 'SOLAsset',
  SOLCollection = 'SOLCollection',
  BTCAsset = 'BTCAsset',
}

export type ListItemType<T> = {
  data: T;
  isAsset: boolean;
};

export type ListItemComponentType<T> = ComponentProps<typeof Box> &
  ListItemType<T> & {
    onSelect: (data: T) => void;
  };

export type InscriptionContentProps = {
  asset: NFTBTCAssetModel;
} & ComponentProps<typeof Box>;
