import type { INetwork } from '@onekeyhq/engine/src/types';
import type { Account } from '@onekeyhq/engine/src/types/account';
import type {
  AddEVMNetworkParams,
  Network,
  SwitchRpcParams,
} from '@onekeyhq/engine/src/types/network';
import type { Token } from '@onekeyhq/engine/src/types/token';
import type { WalletType } from '@onekeyhq/engine/src/types/wallet';

import { ManageNetworkModalRoutes } from '../../routes/routesEnum';

export { ManageNetworkModalRoutes };

export type ManageNetworkRoutesParams = {
  [ManageNetworkModalRoutes.NetworkAccountSelector]:
    | undefined
    | {
        hideAllNetworks?: boolean;
        hideSideChain?: boolean;
        hideSearchBar?: boolean;
        hideCreateAccount?: boolean;
        hideAccountActions?: boolean;
        multiSelect?: boolean;
        singleSelect?: boolean;
        tokenShowBalance?: Token;
        onAccountsSelected?: (accounts: string[]) => void;
        walletsToHide?: WalletType[];
      };
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
  [ManageNetworkModalRoutes.SwitchNetwork]: {
    query: string;
    networkId?: string;
  };

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

export type NetworkWithAccounts = Network & {
  accounts: Account[];
  selected: boolean;
};
