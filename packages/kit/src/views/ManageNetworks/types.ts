import type { AddEVMNetworkParams } from '@onekeyhq/engine/src/types/network';

import { ManageNetworkRoutes } from '../../routes/routesEnum';

export { ManageNetworkRoutes };

export type ManageNetworkRoutesParams = {
  [ManageNetworkRoutes.NetworkAccountSelector]: undefined;
  [ManageNetworkRoutes.NetworkSelector]: undefined;
  [ManageNetworkRoutes.Listing]: { onEdited?: () => void } | undefined;
  [ManageNetworkRoutes.AddNetwork]: {
    mode?: 'add' | 'edit';
    network?: AddEVMNetworkParams & {
      id?: string;
    };
  };
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
  [ManageNetworkRoutes.SwitchNetwork]: { query: string };

  [ManageNetworkRoutes.RPCNode]: { networkId: string };

  [ManageNetworkRoutes.QuickAdd]: undefined;

  [ManageNetworkRoutes.Sort]: undefined;
};
