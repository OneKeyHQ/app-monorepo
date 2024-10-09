import type {
  IAccountSelectorAvailableNetworks,
  IAccountSelectorRouteParams,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IServerNetwork } from '@onekeyhq/shared/types';

export enum EChainSelectorPages {
  AccountChainSelector = 'AccountChainSelector',
  ChainSelector = 'ChainSelector',
  AddCustomNetwork = 'AddCustomNetwork',
}
export type IAccountChainSelectorRouteParams = IAccountSelectorRouteParams &
  IAccountSelectorAvailableNetworks & {
    editable?: boolean;
  };

export type IChainSelectorParams = {
  defaultNetworkId?: string;
  networkIds?: string[];
  title?: string;
  onSelect?: (network: IServerNetwork) => void;
  disableNetworkIds?: string[];
  grouped?: boolean;
};

export type IChainSelectorParamList = {
  [EChainSelectorPages.AccountChainSelector]: IAccountChainSelectorRouteParams;
  [EChainSelectorPages.ChainSelector]?: IChainSelectorParams;
  [EChainSelectorPages.AddCustomNetwork]: {
    state: 'add' | 'edit';
    networkId?: string;
    networkName?: string;
    rpcUrl?: string;
    chainId?: number;
    symbol?: string;
    blockExplorerUrl?: string;
    onSuccess?: (network: IServerNetwork) => void;
    onDeleteSuccess?: () => void;
  };
};
