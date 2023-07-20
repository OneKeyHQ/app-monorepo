import type { INetwork } from '@onekeyhq/engine/src/types';
import type { Account } from '@onekeyhq/engine/src/types/account';
import type {
  AddEVMNetworkParams,
  Network,
  SwitchRpcParams,
} from '@onekeyhq/engine/src/types/network';

import { ManageNetworkModalRoutes } from '../../routes/routesEnum';

export { ManageNetworkModalRoutes };

export type ManageNetworkRoutesParams = {
  [ManageNetworkModalRoutes.NetworkAccountSelector]: undefined;
  [ManageNetworkModalRoutes.NetworkSelector]:
    | undefined
    | {
        networkImpl?: string;
        onSelected?: (networkId: string) => void;
        selectableNetworks?: INetwork[];
        sortDisabled?: boolean;
        customDisabled?: boolean;
        rpcStatusDisabled?: boolean;
        selectedNetworkId?: string;
        allowSelectAllNetworks?: boolean;
      };
  [ManageNetworkModalRoutes.Listing]: { onEdited?: () => void } | undefined;
  [ManageNetworkModalRoutes.AddNetwork]: {
    mode?: 'add' | 'edit';
    network?: AddEVMNetworkParams & {
      id?: string;
    };
  };
  [ManageNetworkModalRoutes.SwitchRpc]: SwitchRpcParams | { query: string };
  [ManageNetworkModalRoutes.CustomNetwork]: {
    id: string;
    name?: string;
    rpcURL?: string;
    chainId?: string;
    symbol?: string;
    exploreUrl?: string;
  };
  [ManageNetworkModalRoutes.PresetNetwork]: {
    id: string;
    name?: string;
    rpcURL?: string;
    chainId?: string;
    symbol?: string;
    exploreUrl?: string;
    impl?: string;
  };
  [ManageNetworkModalRoutes.AddNetworkConfirm]:
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
  [ManageNetworkModalRoutes.SwitchNetwork]: { query: string };

  [ManageNetworkModalRoutes.RPCNode]: { networkId: string };

  [ManageNetworkModalRoutes.QuickAdd]: undefined;

  [ManageNetworkModalRoutes.Sort]: undefined;

  [ManageNetworkModalRoutes.AllNetworksNetworkSelector]: {
    walletId: string;
    accountId: string;
    filter?: (params: {
      network?: Network | null;
      account?: Account | null;
    }) => boolean;
    onConfirm?: (params: { network: Network; account: Account }) => unknown;
    onCancel?: () => unknown;
  };
  [ManageNetworkModalRoutes.AllNetworksAccountsDetail]: {
    walletId: string;
    accountId: string;
  };
  [ManageNetworkModalRoutes.AllNetworksSupportedNetworks]: undefined;
};
