export enum EDiscoveryModalRoutes {
  MobileTabList = 'MobileTabList',
  SearchModal = 'SearchModal',
  BookmarkListModal = 'BookmarkListModal',
  HistoryListModal = 'HistoryListModal',
}

export type IDiscoveryModalParamList = {
  [EDiscoveryModalRoutes.MobileTabList]: undefined;
  [EDiscoveryModalRoutes.SearchModal]: {
    tabId?: string;
    useCurrentWindow?: boolean;
    url: string;
  };
  [EDiscoveryModalRoutes.BookmarkListModal]: undefined;
  [EDiscoveryModalRoutes.HistoryListModal]: undefined;
};
