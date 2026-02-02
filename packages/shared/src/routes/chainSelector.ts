import type {
  IAccountSelectorAvailableNetworks,
  IAccountSelectorRouteParams,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import type { ITokenSelectorParamList } from './assetSelector';

export enum EChainSelectorPages {
  AccountChainSelector = 'AccountChainSelector',
  ChainSelector = 'ChainSelector',
  AddCustomNetwork = 'AddCustomNetwork',
  AllNetworksManager = 'AllNetworksManager',
  TokenSelector = 'TokenSelector',
}
export type IAccountChainSelectorRouteParams = IAccountSelectorRouteParams &
  IAccountSelectorAvailableNetworks & {
    editable?: boolean;
    recentNetworksEnabled?: boolean;
    recordNetworkHistoryEnabled?: boolean;
  };

export type IChainSelectorParams = {
  defaultNetworkId?: string;
  networkIds?: string[];
  title?: string;
  onSelect?: (network: IServerNetwork) => void;
  disableNetworkIds?: string[];
  grouped?: boolean;
  excludeAllNetworkItem?: boolean;
  closeAfterSelect?: boolean;
};

export type IChainSelectorParamList = {
  [EChainSelectorPages.TokenSelector]: ITokenSelectorParamList;
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
  [EChainSelectorPages.AllNetworksManager]: {
    walletId: string;
    accountId?: string;
    indexedAccountId?: string;
    onNetworksChanged?: () => Promise<void>;
  };
};
