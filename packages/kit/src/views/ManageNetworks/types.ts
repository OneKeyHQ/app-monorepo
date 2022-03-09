export enum ManageNetworkRoutes {
  Listing = 'Listing',
  AddNetwork = 'AddNetwork',
  CustomNetwork = 'CustomNetwork',
}

export type ManageNetworkRoutesParams = {
  [ManageNetworkRoutes.Listing]: undefined;
  [ManageNetworkRoutes.AddNetwork]: undefined;
  [ManageNetworkRoutes.CustomNetwork]: {
    defaultValues: {
      name?: string;
      url?: string;
      chainId?: string;
      symbol?: string;
      exploreUrl?: string;
    };
    isReadOnly?: boolean;
  };
};
