export type DAppItemType = {
  _id: string;
  name: string;
  url: string;
  logoURL: string;
  subtitle: string;
  networkIds: string[];
  _subtitle?: string;
};

export type WebSiteHistory = {
  title?: string;
  url?: string;
  favicon?: string;
};

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
