export enum DiscoverModalRoutes {
  MobileTabList = 'MobileTabList',
  SearchModal = 'SearchModal',
}

export type DiscoverModalParamList = {
  [DiscoverModalRoutes.MobileTabList]: undefined;
  [DiscoverModalRoutes.SearchModal]: {
    onSubmitContent?: (content: string) => void;
  };
};
