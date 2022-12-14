import type { Collection } from '@onekeyhq/engine/src/types/nft';

export enum NFTAttributeFilterRoutes {
  FilterModal = 'FilterModal',
}

export type NFTAttributeFilterRoutesParams = {
  [NFTAttributeFilterRoutes.FilterModal]: {
    collection: Collection;
    attributes: {
      attribute_name: string;
      attribute_values: string[];
    }[];
    onAttributeSelected: (
      attributes: { attribute_name: string; attribute_values: string[] }[],
    ) => void;
  };
};
