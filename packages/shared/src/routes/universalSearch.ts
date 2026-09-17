import type {
  EUniversalSearchSource,
  EUniversalSearchType,
} from '../../types/search';

export enum EUniversalSearchPages {
  UniversalSearch = 'UniversalSearch',
  MarketDetail = 'MarketDetail',
}

export type IUniversalSearchParamList = {
  [EUniversalSearchPages.UniversalSearch]: {
    source: EUniversalSearchSource;
    filterTypes?: EUniversalSearchType[];
    initialTab?: 'market' | 'dapp';
  };
  [EUniversalSearchPages.MarketDetail]: {
    token: string;
  };
};
