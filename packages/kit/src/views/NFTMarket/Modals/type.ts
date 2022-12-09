import { BigNumber } from 'bignumber.js';

import { Network } from '@onekeyhq/engine/src/types/network';
import { Collection, NFTNPL } from '@onekeyhq/engine/src/types/nft';

export enum NFTMarketRoutes {
  SearchModal = 'SearchModal',
  FilterModal = 'FilterModal',
  ShareNFTNPLModal = 'ShareNFTNPLModal',
}

export type NFTMarketRoutesParams = {
  [NFTMarketRoutes.SearchModal]: {
    onSelectCollection: ({
      networkId,
      contractAddress,
      collection,
    }: {
      networkId: string;
      contractAddress: string;
      collection?: Collection;
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
  [NFTMarketRoutes.ShareNFTNPLModal]: {
    assets: NFTNPL[];
    win?: number;
    lose?: number;
    totalProfit?: BigNumber;
    network: Network;
    name?: string;
    address: string;
    startTime: number;
    endTime: number;
  };
};
