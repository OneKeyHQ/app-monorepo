import type { Network } from '@onekeyhq/engine/src/types/network';
import type { Collection, MarketPlace } from '@onekeyhq/engine/src/types/nft';

import type { PNLData } from '../PNL/PNLDetail';

export enum NFTMarketRoutes {
  SearchModal = 'SearchModal',
  FilterModal = 'FilterModal',
  ShareNFTPNLModal = 'ShareNFTPNLModal',
  CalculatorModal = 'CalculatorModal',
  MarketPlaceScreen = 'MarketPlaceScreen',
}

export type NFTMarketRoutesParams = {
  [NFTMarketRoutes.SearchModal]: {
    ethOnly?: boolean;
    onSelectCollection: ({
      networkId,
      contractAddress,
      collection,
      title,
    }: {
      networkId: string;
      contractAddress: string;
      collection?: Collection;
      title?: string;
    }) => void;
  };
  [NFTMarketRoutes.FilterModal]: {
    collection: Collection;
    attributes: {
      attribute_name: string;
      attribute_values: string[];
    }[];
    onAttributeSelected: (
      attributes: { attribute_name: string; attribute_values: string[] }[],
    ) => void;
  };
  [NFTMarketRoutes.ShareNFTPNLModal]: {
    network: Network;
    nameOrAddress?: string;
    data: PNLData;
  };
  [NFTMarketRoutes.CalculatorModal]: undefined;
  [NFTMarketRoutes.MarketPlaceScreen]: {
    selectMarket?: MarketPlace;
    onSelect: (item: MarketPlace) => void;
  };
};
