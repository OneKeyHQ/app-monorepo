import type { EUniversalSearchType } from '../../types/search';

export enum EUniversalSearchPages {
  UniversalSearch = 'UniversalSearch',
  MarketDetail = 'MarketDetail',
}

export type IUniversalSearchParamList = {
  [EUniversalSearchPages.UniversalSearch]: {
    filterTypes?: EUniversalSearchType[];
    initialTab?: 'market' | 'dapp';
  };
  [EUniversalSearchPages.MarketDetail]: {
    token: string;
  };
};
