export enum EDiscoveryModalRoutes {
  MobileTabList = 'MobileTabList',
  SearchModal = 'SearchModal',
  FakeSearchModal = 'FakeSearchModal',
  BookmarkListModal = 'BookmarkListModal',
  HistoryListModal = 'HistoryListModal',
}

export type IDiscoveryModalParamList = {
  [EDiscoveryModalRoutes.MobileTabList]: undefined;
  [EDiscoveryModalRoutes.SearchModal]: {
    onSubmitContent?: (content: string) => void;
  };
  [EDiscoveryModalRoutes.FakeSearchModal]: undefined;
  [EDiscoveryModalRoutes.BookmarkListModal]: undefined;
  [EDiscoveryModalRoutes.HistoryListModal]: undefined;
};
