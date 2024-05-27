import type { EUniversalSearchType } from '../../types/search';

export enum EUniversalSearchPages {
  UniversalSearch = 'UniversalSearch',
}

export type IUniversalSearchParamList = {
  [EUniversalSearchPages.UniversalSearch]: {
    filterType?: EUniversalSearchType;
  };
};
