export enum EDiscoveryModalRoutes {
  MobileTabList = 'MobileTabList',
  SearchModal = 'SearchModal',
  FakeSearchModal = 'FakeSearchModal',
}

export type IDiscoveryModalParamList = {
  [EDiscoveryModalRoutes.MobileTabList]: undefined;
  [EDiscoveryModalRoutes.SearchModal]: {
    onSubmitContent?: (content: string) => void;
  };
  [EDiscoveryModalRoutes.FakeSearchModal]: undefined;
};
