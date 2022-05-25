export enum ManageNetworkRoutes {
  Listing = 'Listing',
  AddNetwork = 'AddNetwork',
  CustomNetwork = 'CustomNetwork',
  PresetNetwork = 'PresetNetwork',
  AddNetworkConfirm = 'AddNetworkConfirm',
}

export type ManageNetworkRoutesParams = {
  [ManageNetworkRoutes.Listing]: { onEdited?: () => void } | undefined;
  [ManageNetworkRoutes.AddNetwork]: undefined;
  [ManageNetworkRoutes.CustomNetwork]: {
    id: string;
    name?: string;
    rpcURL?: string;
    chainId?: string;
    symbol?: string;
    exploreUrl?: string;
  };
  [ManageNetworkRoutes.PresetNetwork]: {
    id: string;
    name?: string;
    rpcURL?: string;
    chainId?: string;
    symbol?: string;
    exploreUrl?: string;
    impl?: string;
  };
  [ManageNetworkRoutes.AddNetworkConfirm]:
    | {
        id: string;
        name?: string;
        rpcURL?: string;
        chainId?: string;
        symbol?: string;
        exploreUrl?: string;
        iconUrl?: string;
      }
    | { query: string };
};
