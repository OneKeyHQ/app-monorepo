import type { Network } from '@onekeyhq/engine/src/types/network';
import type {
  Collection,
  MarketPlace,
  NFTPNL,
} from '@onekeyhq/engine/src/types/nft';

import type { BigNumber } from 'bignumber.js';

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
    assets: NFTPNL[];
    win?: number;
    lose?: number;
    totalProfit?: BigNumber;
    network: Network;
    nameOrAddress?: string;
    startTime: number;
    endTime: number;
  };
  [NFTMarketRoutes.CalculatorModal]: undefined;
  [NFTMarketRoutes.MarketPlaceScreen]: {
    selectMarket?: MarketPlace;
    onSelect: (item: MarketPlace) => void;
  };
};
