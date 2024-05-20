export enum EUniversalSearchPages {
  UniversalSearch = 'UniversalSearch',
}

export enum EUniversalSearchFilterTypes {
  'account' = 'account',
  'market' = 'market',
}

export type IUniversalSearchParamList = {
  [EUniversalSearchPages.UniversalSearch]: {
    filterType?: EUniversalSearchFilterTypes;
  };
};
