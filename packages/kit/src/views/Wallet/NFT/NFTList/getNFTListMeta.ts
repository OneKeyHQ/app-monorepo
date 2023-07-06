import { parseNetworkId } from '@onekeyhq/engine/src/managers/network';
import type {
  Collection,
  NFTAsset,
  NFTBTCAssetModel,
} from '@onekeyhq/engine/src/types/nft';
import { NFTAssetType } from '@onekeyhq/engine/src/types/nft';
import {
  IMPL_BTC,
  IMPL_EVM,
  IMPL_SOL,
} from '@onekeyhq/shared/src/engine/engineConsts';

import CollectionCard, {
  keyExtractor as CollectionKeyExtractor,
} from './CollectionCard';
import NFTBTCAssetCard, {
  keyExtractor as BTCAssetKeyExtractor,
} from './NFTBTCAssetCard';
import NFTListAssetCard, {
  keyExtractor as NFTAssetKeyExtractor,
} from './NFTListAssetCard';
import { NFTCardType } from './type';

import type { ListDataType, ListItemComponentType, ListItemType } from './type';

export type INFTListProps = {
  data: NFTBTCAssetModel | Collection;
  type?: NFTAssetType;
  expand: boolean;
};

export type INFTListMeta = Collection | NFTAsset;
export type IGetNFTMetaReturn = ListItemType<ListDataType>[];

function ComponentWithCardType(
  cardType: NFTCardType,
): (props: ListItemComponentType<any>) => JSX.Element | null {
  switch (cardType) {
    case NFTCardType.BTCAsset:
      return NFTBTCAssetCard;
    case NFTCardType.SOLAsset:
    case NFTCardType.EVMAsset:
      return NFTListAssetCard;
    default:
      return CollectionCard;
  }
}

function keyExtractorWithCardType(
  cardType: NFTCardType,
): (item: ListItemType<ListDataType>, index: number) => string {
  switch (cardType) {
    case NFTCardType.BTCAsset:
      return BTCAssetKeyExtractor;
    case NFTCardType.SOLAsset:
    case NFTCardType.EVMAsset:
      return NFTAssetKeyExtractor;
    default:
      return CollectionKeyExtractor;
  }
}

export function getNFTListComponent(
  props: Pick<INFTListProps, 'type' | 'expand'>,
): {
  cardType: NFTCardType;
  expandEnable: boolean;
  Component: ReturnType<typeof ComponentWithCardType>;
  keyExtractor: ReturnType<typeof keyExtractorWithCardType>;
} {
  const { type, expand } = props;
  let expandEnable = true;
  let cardType: NFTCardType = NFTCardType.EVMCollection;
  if (type === NFTAssetType.BTC) {
    cardType = NFTCardType.BTCAsset;
    expandEnable = false;
  }
  if (expand) {
    cardType = NFTCardType.EVMAsset;
  }
  return {
    Component: ComponentWithCardType(cardType),
    cardType,
    expandEnable,
    keyExtractor: keyExtractorWithCardType(cardType),
  };
}

export const getCardTypeByNetworkId = (
  networkId: string,
): NFTAssetType | undefined => {
  const { impl } = parseNetworkId(networkId);
  if (impl === IMPL_EVM) {
    return NFTAssetType.EVM;
  }
  if (impl === IMPL_SOL) {
    return NFTAssetType.SOL;
  }
  if (impl === IMPL_BTC) {
    return NFTAssetType.BTC;
  }
};

export function getNFTListMeta(props: INFTListProps): IGetNFTMetaReturn {
  const { data, type, expand } = props;
  if (!type) {
    return [];
  }
  if (type === NFTAssetType.BTC) {
    return [{ data, isAsset: true, type }];
  }
  const collection = data as Collection;
  if (expand) {
    return collection.assets.map((item) => ({
      data: item,
      isAsset: true,
      type,
    }));
  }
  return [{ data, isAsset: false, type }];
}
