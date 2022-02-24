export enum ManageNetworkModalRoutes {
  NetworkListViewModal = 'NetworkListViewModal',
  NetworkAddViewModal = 'NetworkAddViewModal',
  NetworkCustomViewModal = 'NetworkCustomView',
}

export type ManageNetworkRoutesParams = {
  [ManageNetworkModalRoutes.NetworkListViewModal]: undefined;
  [ManageNetworkModalRoutes.NetworkAddViewModal]: undefined;
  [ManageNetworkModalRoutes.NetworkCustomViewModal]: {
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
