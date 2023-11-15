export enum EDiscoveryModalRoutes {
  MobileTabList = 'MobileTabList',
  SearchModal = 'SearchModal',
}

export type IDiscoveryModalParamList = {
  [EDiscoveryModalRoutes.MobileTabList]: undefined;
  [EDiscoveryModalRoutes.SearchModal]: {
    onSubmitContent?: (content: string) => void;
  };
};
